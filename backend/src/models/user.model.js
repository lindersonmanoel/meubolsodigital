"use strict";

const pool = require("../database/pool");

const PUBLIC_FIELDS = "id, nome, email, criado_em, atualizado_em";

async function findByEmail(email) {
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
  return rows[0] || null;
}

async function findById(id, { comSenha = false } = {}) {
  const campos = comSenha ? `${PUBLIC_FIELDS}, senha_hash` : PUBLIC_FIELDS;
  const { rows } = await pool.query(`SELECT ${campos} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ nome, email, senhaHash }) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING ${PUBLIC_FIELDS}`,
    [nome, email, senhaHash]
  );
  return rows[0];
}

async function updateProfile(id, { nome, email }) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET nome = $1, email = $2, atualizado_em = now() WHERE id = $3 RETURNING ${PUBLIC_FIELDS}`,
    [nome, email, id]
  );
  return rows[0] || null;
}

async function updateSenhaHash(id, senhaHash) {
  const { rowCount } = await pool.query(
    "UPDATE usuarios SET senha_hash = $1, atualizado_em = now() WHERE id = $2",
    [senhaHash, id]
  );
  return rowCount > 0;
}

module.exports = { findByEmail, findById, create, updateProfile, updateSenhaHash };
