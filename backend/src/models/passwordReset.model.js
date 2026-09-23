"use strict";

const pool = require("../database/pool");

async function criar({ usuarioId, tokenHash, expiraEm }) {
  await pool.query(
    "INSERT INTO tokens_recuperacao_senha (usuario_id, token_hash, expira_em) VALUES ($1, $2, $3)",
    [usuarioId, tokenHash, expiraEm]
  );
}

async function buscarValidoPorHash(tokenHash) {
  const { rows } = await pool.query(
    `SELECT * FROM tokens_recuperacao_senha
      WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > now()`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function marcarUsado(id) {
  await pool.query("UPDATE tokens_recuperacao_senha SET usado_em = now() WHERE id = $1", [id]);
}

// Pedir recuperacao de novo invalida o link anterior - so' o mais recente funciona.
async function invalidarPendentes(usuarioId) {
  await pool.query(
    "UPDATE tokens_recuperacao_senha SET usado_em = now() WHERE usuario_id = $1 AND usado_em IS NULL",
    [usuarioId]
  );
}

module.exports = { criar, buscarValidoPorHash, marcarUsado, invalidarPendentes };
