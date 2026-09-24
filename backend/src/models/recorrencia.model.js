"use strict";

const pool = require("../database/pool");

const CAMPOS = `r.id, r.tipo, r.descricao, r.valor, r.dia_mes, r.ativa, r.categoria_id,
                c.nome AS categoria_nome, r.ultimo_mes_gerado, r.criado_em, r.atualizado_em`;
const SELECT_BASE = `SELECT ${CAMPOS} FROM recorrencias r LEFT JOIN categorias c ON c.id = r.categoria_id`;

async function listar(usuarioId) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE r.usuario_id = $1 ORDER BY r.ativa DESC, r.dia_mes`, [usuarioId]);
  return rows;
}

async function listarAtivas(usuarioId) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE r.usuario_id = $1 AND r.ativa = true`, [usuarioId]);
  return rows;
}

async function buscarPorId(usuarioId, id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE r.usuario_id = $1 AND r.id = $2`, [usuarioId, id]);
  return rows[0] || null;
}

async function criar(usuarioId, { tipo, descricao, valor, diaMes, categoriaId, ativa }) {
  const { rows } = await pool.query(
    `INSERT INTO recorrencias (usuario_id, categoria_id, tipo, descricao, valor, dia_mes, ativa)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [usuarioId, categoriaId || null, tipo, descricao, valor, diaMes, ativa !== false]
  );
  return buscarPorId(usuarioId, rows[0].id);
}

async function atualizar(usuarioId, id, { tipo, descricao, valor, diaMes, categoriaId, ativa }) {
  const { rows } = await pool.query(
    `UPDATE recorrencias
        SET categoria_id = $1, tipo = $2, descricao = $3, valor = $4, dia_mes = $5, ativa = $6, atualizado_em = now(),
            -- Reativando uma recorrencia pausada: nao "recupera" os meses em que ficou parada; volta a gerar
            -- a partir do mes atual (marca o mes anterior como ja' processado).
            ultimo_mes_gerado = CASE WHEN ativa = false AND $6::boolean = true
              THEN (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month')::date
              ELSE ultimo_mes_gerado END
      WHERE usuario_id = $7 AND id = $8
      RETURNING id`,
    [categoriaId || null, tipo, descricao, valor, diaMes, ativa !== false, usuarioId, id]
  );
  if (!rows[0]) return null;
  return buscarPorId(usuarioId, rows[0].id);
}

async function remover(usuarioId, id) {
  const { rowCount } = await pool.query("DELETE FROM recorrencias WHERE usuario_id = $1 AND id = $2", [usuarioId, id]);
  return rowCount > 0;
}

/** Avanca (nunca recua) o ultimo mes processado da recorrencia. dataISO = "AAAA-MM-01". */
async function marcarUltimoMes(id, dataISO) {
  await pool.query(
    "UPDATE recorrencias SET ultimo_mes_gerado = GREATEST(COALESCE(ultimo_mes_gerado, DATE '0001-01-01'), $2::date) WHERE id = $1",
    [id, dataISO]
  );
}

module.exports = { listar, listarAtivas, buscarPorId, criar, atualizar, remover, marcarUltimoMes };
