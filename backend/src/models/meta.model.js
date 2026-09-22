"use strict";

const pool = require("../database/pool");

const CAMPOS = "id, nome, valor_objetivo, valor_atual, prazo, descricao, criado_em, atualizado_em";

async function listar(usuarioId) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS} FROM metas WHERE usuario_id = $1 ORDER BY prazo NULLS LAST, criado_em`,
    [usuarioId]
  );
  return rows;
}

async function buscarPorId(usuarioId, id) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM metas WHERE usuario_id = $1 AND id = $2`, [usuarioId, id]);
  return rows[0] || null;
}

async function criar(usuarioId, dados) {
  const { rows } = await pool.query(
    `INSERT INTO metas (usuario_id, nome, valor_objetivo, valor_atual, prazo, descricao)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${CAMPOS}`,
    [usuarioId, dados.nome, dados.valorObjetivo, dados.valorAtual, dados.prazo, dados.descricao]
  );
  return rows[0];
}

async function atualizar(usuarioId, id, dados) {
  const { rows } = await pool.query(
    `UPDATE metas SET nome = $1, valor_objetivo = $2, valor_atual = $3, prazo = $4, descricao = $5, atualizado_em = now()
      WHERE usuario_id = $6 AND id = $7 RETURNING ${CAMPOS}`,
    [dados.nome, dados.valorObjetivo, dados.valorAtual, dados.prazo, dados.descricao, usuarioId, id]
  );
  return rows[0] || null;
}

async function remover(usuarioId, id) {
  const { rowCount } = await pool.query("DELETE FROM metas WHERE usuario_id = $1 AND id = $2", [usuarioId, id]);
  return rowCount > 0;
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
