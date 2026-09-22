"use strict";

const pool = require("../database/pool");

const CAMPOS = `r.id, r.tipo, r.descricao, r.valor, r.dia_mes, r.ativa, r.categoria_id,
                c.nome AS categoria_nome, r.criado_em, r.atualizado_em`;
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
        SET categoria_id = $1, tipo = $2, descricao = $3, valor = $4, dia_mes = $5, ativa = $6, atualizado_em = now()
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

module.exports = { listar, listarAtivas, buscarPorId, criar, atualizar, remover };
