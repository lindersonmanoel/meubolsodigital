"use strict";

const pool = require("../database/pool");

const SELECT_BASE = `
  SELECT m.id, m.tipo, m.descricao, m.valor, m.data, m.observacao, m.categoria_id,
         c.nome AS categoria_nome, m.recorrencia_id, m.criado_em, m.atualizado_em
  FROM movimentacoes m
  LEFT JOIN categorias c ON c.id = m.categoria_id
`;

/** Monta a clausula WHERE e os parametros a partir dos filtros (todos opcionais). */
function montarFiltro(usuarioId, filtros) {
  const condicoes = ["m.usuario_id = $1"];
  const valores = [usuarioId];

  function add(sql, valor) {
    valores.push(valor);
    condicoes.push(sql.replace("?", `$${valores.length}`));
  }

  if (filtros.tipo) add("m.tipo = ?", filtros.tipo);
  if (filtros.categoriaId) add("m.categoria_id = ?", filtros.categoriaId);
  if (filtros.inicio) add("m.data >= ?", filtros.inicio);
  if (filtros.fim) add("m.data <= ?", filtros.fim);
  if (filtros.busca) add("m.descricao ILIKE ?", `%${filtros.busca}%`);
  if (filtros.valorMin != null) add("m.valor >= ?", filtros.valorMin);
  if (filtros.valorMax != null) add("m.valor <= ?", filtros.valorMax);

  return { where: condicoes.join(" AND "), valores };
}

async function listar(usuarioId, filtros = {}, paginacao = null) {
  const { where, valores } = montarFiltro(usuarioId, filtros);
  let sql = `${SELECT_BASE} WHERE ${where} ORDER BY m.data DESC, m.id DESC`;
  if (paginacao) {
    valores.push(paginacao.limite, paginacao.offset);
    sql += ` LIMIT $${valores.length - 1} OFFSET $${valores.length}`;
  }
  const { rows } = await pool.query(sql, valores);
  return rows;
}

async function contar(usuarioId, filtros = {}) {
  const { where, valores } = montarFiltro(usuarioId, filtros);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM movimentacoes m WHERE ${where}`, valores);
  return rows[0].total;
}

async function buscarPorId(usuarioId, id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE m.usuario_id = $1 AND m.id = $2`, [usuarioId, id]);
  return rows[0] || null;
}

async function criar(usuarioId, dados) {
  const { rows } = await pool.query(
    `INSERT INTO movimentacoes (usuario_id, categoria_id, tipo, descricao, valor, data, observacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [usuarioId, dados.categoriaId || null, dados.tipo, dados.descricao, dados.valor, dados.data, dados.observacao || null]
  );
  return buscarPorId(usuarioId, rows[0].id);
}

/** tipoFixo (opcional): nas rotas /receitas e /despesas so' mexe em registros desse tipo. */
async function atualizar(usuarioId, id, dados, tipoFixo = null) {
  const { rows } = await pool.query(
    `UPDATE movimentacoes
        SET categoria_id = $1, tipo = $2, descricao = $3, valor = $4, data = $5, observacao = $6, atualizado_em = now()
      WHERE usuario_id = $7 AND id = $8 AND ($9::text IS NULL OR tipo = $9)
      RETURNING id`,
    [dados.categoriaId || null, dados.tipo, dados.descricao, dados.valor, dados.data, dados.observacao || null, usuarioId, id, tipoFixo]
  );
  if (!rows[0]) return null;
  return buscarPorId(usuarioId, rows[0].id);
}

async function remover(usuarioId, id, tipoFixo = null) {
  const { rowCount } = await pool.query(
    "DELETE FROM movimentacoes WHERE usuario_id = $1 AND id = $2 AND ($3::text IS NULL OR tipo = $3)",
    [usuarioId, id, tipoFixo]
  );
  return rowCount > 0;
}

/** Ja existe uma movimentacao gerada por essa recorrencia neste mes (evita duplicar)? */
async function existeGeradaNoMes(usuarioId, recorrenciaId, anoMes) {
  const { rows } = await pool.query(
    `SELECT 1 FROM movimentacoes
      WHERE usuario_id = $1 AND recorrencia_id = $2 AND to_char(data, 'YYYY-MM') = $3
      LIMIT 1`,
    [usuarioId, recorrenciaId, anoMes]
  );
  return rows.length > 0;
}

/** Cria a movimentacao do mes a partir de uma recorrencia (receita/despesa fixa). */
async function criarDeRecorrencia(usuarioId, { recorrenciaId, categoriaId, tipo, descricao, valor, data }) {
  const { rows } = await pool.query(
    // ON CONFLICT DO NOTHING: com o indice unico (recorrencia + mes) da migracao 007, uma segunda
    // requisicao simultanea nao duplica o lancamento - devolve null.
    `INSERT INTO movimentacoes (usuario_id, categoria_id, tipo, descricao, valor, data, recorrencia_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
    [usuarioId, categoriaId || null, tipo, descricao, valor, data, recorrenciaId]
  );
  if (!rows[0]) return null;
  return buscarPorId(usuarioId, rows[0].id);
}

/** Totais de receita/despesa dentro de um periodo (usado pelo dashboard e pelos relatorios). */
async function totaisPorTipo(usuarioId, { inicio, fim } = {}) {
  const condicoes = ["usuario_id = $1"];
  const valores = [usuarioId];
  if (inicio) { valores.push(inicio); condicoes.push(`data >= $${valores.length}`); }
  if (fim) { valores.push(fim); condicoes.push(`data <= $${valores.length}`); }
  const { rows } = await pool.query(
    `SELECT tipo, COALESCE(SUM(valor), 0)::float8 AS total, COUNT(*)::int AS quantidade
       FROM movimentacoes WHERE ${condicoes.join(" AND ")} GROUP BY tipo`,
    valores
  );
  const resultado = { receita: { total: 0, quantidade: 0 }, despesa: { total: 0, quantidade: 0 } };
  rows.forEach((r) => { resultado[r.tipo] = { total: r.total, quantidade: r.quantidade }; });
  return resultado;
}

/** Saldo total da conta (todas as movimentacoes, sem filtro de periodo). */
async function saldoTotal(usuarioId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0)::float8 AS saldo
       FROM movimentacoes WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows[0].saldo;
}

/** Receitas e despesas por mes, para o grafico - ultimos `meses` meses (incluindo o atual). */
async function porMes(usuarioId, meses = 6) {
  const { rows } = await pool.query(
    `SELECT to_char(serie.mes, 'YYYY-MM') AS mes,
            COALESCE(r.total, 0)::float8 AS receitas,
            COALESCE(d.total, 0)::float8 AS despesas
       FROM generate_series(date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - ($2::int - 1) * interval '1 month',
                             date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo'), interval '1 month') AS serie(mes)
       LEFT JOIN (
         SELECT date_trunc('month', data::timestamp) AS mes, SUM(valor) AS total
           FROM movimentacoes WHERE usuario_id = $1 AND tipo = 'receita' GROUP BY 1
       ) r ON r.mes = serie.mes
       LEFT JOIN (
         SELECT date_trunc('month', data::timestamp) AS mes, SUM(valor) AS total
           FROM movimentacoes WHERE usuario_id = $1 AND tipo = 'despesa' GROUP BY 1
       ) d ON d.mes = serie.mes
       ORDER BY serie.mes`,
    [usuarioId, meses]
  );
  return rows;
}

/** Despesas agrupadas por categoria (pizza do dashboard). Sem categoria vira "Sem categoria". */
async function despesasPorCategoria(usuarioId, { inicio, fim } = {}) {
  const condicoes = ["m.usuario_id = $1", "m.tipo = 'despesa'"];
  const valores = [usuarioId];
  if (inicio) { valores.push(inicio); condicoes.push(`m.data >= $${valores.length}`); }
  if (fim) { valores.push(fim); condicoes.push(`m.data <= $${valores.length}`); }
  const { rows } = await pool.query(
    `SELECT COALESCE(c.nome, 'Sem categoria') AS categoria, SUM(m.valor)::float8 AS total
       FROM movimentacoes m LEFT JOIN categorias c ON c.id = m.categoria_id
      WHERE ${condicoes.join(" AND ")}
      GROUP BY COALESCE(c.nome, 'Sem categoria')
      ORDER BY total DESC`,
    valores
  );
  return rows;
}

module.exports = {
  listar, contar, buscarPorId, criar, atualizar, remover,
  totaisPorTipo, saldoTotal, porMes, despesasPorCategoria,
  existeGeradaNoMes, criarDeRecorrencia,
};
