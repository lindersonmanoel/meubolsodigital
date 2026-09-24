"use strict";

const config = require("./config");
const createApp = require("./app");

const pool = require("./database/pool");

const app = createApp();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Meu Bolso Digital API rodando na porta ${config.port} (ambiente: ${config.nodeEnv})`);
});

// Encerramento gracioso: como o Node roda como PID 1 no container, sem tratar SIGTERM o "docker stop"
// (e todo redeploy) esperava 10 s e matava o processo no meio das requisicoes. Agora para de aceitar
// conexoes novas, deixa terminar as em andamento, fecha o pool do banco e sai com codigo 0.
let encerrando = false;
function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;
  // eslint-disable-next-line no-console
  console.log(`[server] ${sinal} recebido, encerrando...`);
  // Passado o prazo, sai mesmo com conexao presa (keep-alive) - nunca fica pendurado.
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(() => {
    pool.end().catch(() => {}).finally(() => process.exit(0));
  });
  if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
}
process.on("SIGTERM", () => encerrar("SIGTERM"));
process.on("SIGINT", () => encerrar("SIGINT"));
