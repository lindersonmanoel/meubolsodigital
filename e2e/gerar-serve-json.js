"use strict";

// Gera e2e/serve.json a partir do frontend/vercel.json: o servidor estatico local (serve) passa a mandar os MESMOS
// cabecalhos da Vercel (inclusive a Content-Security-Policy), entao os testes exercitam a CSP de verdade.
// A API de producao do connect-src e' trocada pelo backend local dos testes.
const fs = require("fs");
const path = require("path");

const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "frontend", "vercel.json"), "utf8"));
const API_LOCAL = process.env.E2E_API_URL || "http://localhost:3000";
const headers = vercel.headers[0].headers.map(({ key, value }) => ({
  key,
  value: value.replace(/https:\/\/[a-z0-9.-]+\.up\.railway\.app/g, API_LOCAL),
}));

fs.writeFileSync(
  path.join(__dirname, "serve.json"),
  JSON.stringify({ cleanUrls: true, headers: [{ source: "**", headers }] }, null, 2)
);
console.log("serve.json gerado com", headers.map((h) => h.key).join(", "));
