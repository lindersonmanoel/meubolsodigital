"use strict";

const pool = require("../database/pool");

// Traz junto o gasto do mes atual na categoria, pra a tela mostrar "R$ 320 de R$ 500" sem
// precisar de uma segunda chamada.
const SELECT_COM_GASTO = `
  SELECT o.id, o.categoria_id, c.nome AS categoria_nome, o.valor_limite,
         COALESCE(g.total, 0)::float8 AS gasto_no_mes, o.criado_em, o.atualizado_em
    FROM orcamentos o
    JOIN categorias c ON c.id = o.categoria_id
    LEFT JOIN (
      SELECT categoria_id, SUM(valor) AS total
        FROM movimentacoes
       WHERE usuario_id = $1 AND tipo = 'despesa'
         AND data >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date
         AND data < (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month')::date
       GROUP BY categoria_id
    ) g ON g.categoria_id = o.categoria_id
`;

async function listar(usuarioId) {
  const { rows } = await pool.query(`${SELECT_COM_GASTO} WHERE o.usuario_id = $1 ORDER BY c.nome`, [usuarioId]);
  return rows;
}

async function buscarPorId(usuarioId, id) {
  const { rows } = await pool.query(`${SELECT_COM_GASTO} WHERE o.usuario_id = $1 AND o.id = $2`, [usuarioId, id]);
  return rows[0] || null;
}

async function buscarPorCategoria(usuarioId, categoriaId, ignorarId) {
  const { rows } = await pool.query(
    `SELECT id FROM orcamentos WHERE usuario_id = $1 AND categoria_id = $2 AND ($3::bigint IS NULL OR id <> $3)`,
    [usuarioId, categoriaId, ignorarId || null]
  );
  return rows[0] || null;
}

async function criar(usuarioId, { categoriaId, valorLimite }) {
  const { rows } = await pool.query(
    "INSERT INTO orcamentos (usuario_id, categoria_id, valor_limite) VALUES ($1, $2, $3) RETURNING id",
    [usuarioId, categoriaId, valorLimite]
  );
  return buscarPorId(usuarioId, rows[0].id);
}

async function atualizar(usuarioId, id, { valorLimite }) {
  const { rows } = await pool.query(
    "UPDATE orcamentos SET valor_limite = $1, atualizado_em = now() WHERE usuario_id = $2 AND id = $3 RETURNING id",
    [valorLimite, usuarioId, id]
  );
  if (!rows[0]) return null;
  return buscarPorId(usuarioId, rows[0].id);
}

async function remover(usuarioId, id) {
  const { rowCount } = await pool.query("DELETE FROM orcamentos WHERE usuario_id = $1 AND id = $2", [usuarioId, id]);
  return rowCount > 0;
}

module.exports = { listar, buscarPorId, buscarPorCategoria, criar, atualizar, remover };
