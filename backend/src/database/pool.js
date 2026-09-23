"use strict";

const { Pool } = require("pg");
const config = require("../config");

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL não configurado. Preencha o .env (veja .env.example).");
}

// Sem DATABASE_SSL_CA, o host costuma usar certificado autoassinado (comum em
// Railway/Heroku) e validar a cadeia derrubaria a conexao - por isso o fallback
// sem verificacao. Defina DATABASE_SSL_CA com o certificado da CA do provedor
// para validar a conexao com o banco de verdade.
const ssl = config.databaseSsl
  ? config.databaseSslCa
    ? { ca: config.databaseSslCa, rejectUnauthorized: true }
    : { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl,
});

pool.on("error", (err) => {
  // Erro numa conexao ociosa do pool (ex.: banco caiu) - nao deve derrubar o processo inteiro.
  // eslint-disable-next-line no-console
  console.error("[database] erro inesperado numa conexao ociosa do pool:", err.message);
});

module.exports = pool;
