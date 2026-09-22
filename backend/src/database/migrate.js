"use strict";

// Corredor de migracao simples: aplica, em ordem, os arquivos .sql de database/migrations
// que ainda nao foram aplicados, e registra cada um numa tabela de controle.
// Sem dependencia externa (sem knex/sequelize) - poucas migracoes, entao um script direto basta.

const fs = require("fs");
const path = require("path");
const pool = require("./pool");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "..", "database", "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      nome        VARCHAR(200) PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function run() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (!files.length) {
    console.log("[migrate] nenhum arquivo de migracao encontrado em", MIGRATIONS_DIR);
    return;
  }

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query("SELECT nome FROM _migrations");
    const applied = new Set(rows.map((r) => r.nome));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] ja aplicada: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] aplicando: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (nome) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Falha ao aplicar ${file}: ${err.message}`);
      }
    }
    console.log("[migrate] concluido.");
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[migrate] erro:", err.message);
    process.exitCode = 1;
  });
}

module.exports = { run };
