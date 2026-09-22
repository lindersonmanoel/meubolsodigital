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

module.exports = { listar, buscarPorId, existeComNome, criar, atualizar, remover };
