"use strict";

const pool = require("../database/pool");

const PUBLIC_FIELDS = "id, nome, email, bio, foto_url, criado_em, atualizado_em";

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

async function updateProfile(id, { nome, email, bio, fotoUrl }) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET nome = $1, email = $2, bio = $3, foto_url = $4, atualizado_em = now()
      WHERE id = $5 RETURNING ${PUBLIC_FIELDS}`,
    [nome, email, bio ?? null, fotoUrl ?? null, id]
  );
  return rows[0] || null;
}

/** Troca o hash e incrementa token_version: todos os tokens (JWT) emitidos antes deixam de valer.
 * Devolve a nova versao (pra emitir um token novo pra sessao atual) ou null se o usuario nao existe. */
async function updateSenhaHash(id, senhaHash) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET senha_hash = $1, token_version = token_version + 1, atualizado_em = now()
      WHERE id = $2 RETURNING token_version`,
    [senhaHash, id]
  );
  return rows[0] ? rows[0].token_version : null;
}

/** Versao atual do token do usuario (null se o usuario nao existe mais). */
async function tokenVersion(id) {
  const { rows } = await pool.query("SELECT token_version FROM usuarios WHERE id = $1", [id]);
  return rows[0] ? rows[0].token_version : null;
}

module.exports = { findByEmail, findById, create, updateProfile, updateSenhaHash, tokenVersion };
