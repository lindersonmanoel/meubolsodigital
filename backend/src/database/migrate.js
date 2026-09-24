"use strict";

// Corredor de migracao simples: aplica, em ordem, os arquivos .sql de database/migrations
// que ainda nao foram aplicados, e registra cada um numa tabela de controle.
// Sem dependencia externa (sem knex/sequelize) - poucas migracoes, entao um script direto basta.

const fs = require("fs");
const path = require("path");
const pool = require("./pool");

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "..", "database", "migrations");
// Numero arbitrario da trava do PostgreSQL (advisory lock); so' precisa ser igual em todas as instancias.
const MIGRATION_LOCK_ID = 727274;

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
  // RAISE WARNING/NOTICE dentro de uma migracao (ex.: "existem duplicatas, indice nao criado") chega aqui como evento;
  // sem este ouvinte o driver descarta a mensagem e o aviso nunca apareceria no log do deploy.
  client.on("notice", (aviso) => console.warn(`[migrate] aviso do banco: ${aviso.message}`));
  try {
    // Uma migracao longa (ex.: preencher uma coluna em tabela grande) nao pode ser cortada pelo statement_timeout do pool.
    await client.query("SET statement_timeout = 0");
    // Trava de sessao: duas instancias subindo juntas nao aplicam a mesma migracao ao mesmo tempo
    // (a segunda espera a primeira terminar e ve tudo como "ja aplicado").
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
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
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
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
