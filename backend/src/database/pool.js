"use strict";

const { Pool } = require("pg");
const config = require("../config");

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL não configurado. Preencha o .env (veja .env.example).");
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  // Erro numa conexao ociosa do pool (ex.: banco caiu) - nao deve derrubar o processo inteiro.
  // eslint-disable-next-line no-console
  console.error("[database] erro inesperado numa conexao ociosa do pool:", err.message);
});

module.exports = pool;
