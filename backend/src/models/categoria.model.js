"use strict";

const pool = require("../database/pool");

async function listar(usuarioId) {
  const { rows } = await pool.query(
    "SELECT id, nome, tipo, criado_em FROM categorias WHERE usuario_id = $1 ORDER BY tipo, nome",
    [usuarioId]
  );
  return rows;
}

async function buscarPorId(usuarioId, id) {
  const { rows } = await pool.query(
    "SELECT id, nome, tipo, criado_em FROM categorias WHERE usuario_id = $1 AND id = $2",
    [usuarioId, id]
  );
  return rows[0] || null;
}

async function existeComNome(usuarioId, nome, tipo, ignorarId) {
  const { rows } = await pool.query(
    `SELECT id FROM categorias WHERE usuario_id = $1 AND lower(nome) = lower($2) AND tipo = $3
       AND ($4::bigint IS NULL OR id <> $4)`,
    [usuarioId, nome, tipo, ignorarId || null]
  );
  return rows.length > 0;
}

async function criar(usuarioId, { nome, tipo }) {
  const { rows } = await pool.query(
    "INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id, nome, tipo, criado_em",
    [usuarioId, nome, tipo]
  );
  return rows[0];
}

async function atualizar(usuarioId, id, { nome, tipo }) {
  const { rows } = await pool.query(
    `UPDATE categorias SET nome = $1, tipo = $2 WHERE usuario_id = $3 AND id = $4
       RETURNING id, nome, tipo, criado_em`,
    [nome, tipo, usuarioId, id]
  );
  return rows[0] || null;
}

async function remover(usuarioId, id) {
  const { rowCount } = await pool.query("DELETE FROM categorias WHERE usuario_id = $1 AND id = $2", [usuarioId, id]);
  return rowCount > 0;
}

/** A categoria já está em uso (movimentação, recorrência ou orçamento)? Usado pra impedir
 * trocar o tipo (receita/despesa) de uma categoria que já tem dados ligados a ela - senão
 * fica uma despesa antiga apontando pra uma categoria que agora é "receita", por exemplo. */
async function emUso(usuarioId, id) {
  const { rows } = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM movimentacoes WHERE usuario_id = $1 AND categoria_id = $2) AS movimentacao,
       EXISTS(SELECT 1 FROM recorrencias WHERE usuario_id = $1 AND categoria_id = $2) AS recorrencia,
       EXISTS(SELECT 1 FROM orcamentos WHERE usuario_id = $1 AND categoria_id = $2) AS orcamento`,
    [usuarioId, id]
  );
  const r = rows[0];
  return r.movimentacao || r.recorrencia || r.orcamento;
}

module.exports = { listar, buscarPorId, existeComNome, criar, atualizar, remover, emUso };
