#!/usr/bin/env node
"use strict";

// Teste de fumaca do ambiente de PRODUCAO (Vercel + Railway/VM): confere que o site e a API estao
// no ar e configurados como esperado. Roda no CI (.github/workflows/smoke-producao.yml) e na mao.
//
// So' faz LEITURAS e requisicoes que a API recusa por validacao: nao cria usuario, nao grava dado.
//
// Uso:   node scripts/smoke-producao.js
// Vars:  FRONTEND_URL  (padrao: https://meu-bolso-digital-web.vercel.app)
//        API_URL       (padrao: https://backend-production-827d.up.railway.app)
// Saida: codigo 0 se tudo passou (avisos nao reprovam), 1 se algum teste obrigatorio falhou.

const FRONTEND_URL = (process.env.FRONTEND_URL || "https://meu-bolso-digital-web.vercel.app").replace(/\/+$/, "");
const API_URL = (process.env.API_URL || "https://backend-production-827d.up.railway.app").replace(/\/+$/, "");
const TIMEOUT_MS = 20000; // a 1a chamada pode acordar uma API "dormindo" (planos gratis)
const LENTO_MS = 5000;

const resultados = [];

async function req(url, opcoes = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  const inicio = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual", ...opcoes, signal: controle.signal });
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch (e) { /* nao e JSON */ }
    return { res, texto, json, ms: Date.now() - inicio };
  } finally {
    clearTimeout(timer);
  }
}

/** obrigatorio=false: se falhar vira AVISO (ex.: recurso que ainda nao foi publicado). */
async function teste(nome, fn, { obrigatorio = true } = {}) {
  try {
    const detalhe = await fn();
    resultados.push({ nome, estado: "OK", detalhe: detalhe || "" });
  } catch (err) {
    resultados.push({ nome, estado: obrigatorio ? "FALHOU" : "AVISO", detalhe: err.message });
  }
}

function esperar(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  console.log(`Frontend: ${FRONTEND_URL}\nAPI:      ${API_URL}\n`);

  // ---------------- Frontend (Vercel) ----------------
  await teste("Site: /login responde 200 com HTML do app", async () => {
    const { res, texto, ms } = await req(`${FRONTEND_URL}/login`);
    esperar(res.status === 200, `status ${res.status}`);
    esperar((res.headers.get("content-type") || "").includes("text/html"), "nao e HTML");
    esperar(/Meu Bolso Digital/i.test(texto), "texto 'Meu Bolso Digital' nao encontrado");
    return `${ms} ms`;
  });

  await teste("Site: cabecalhos de seguranca (HSTS, nosniff, X-Frame-Options, Referrer-Policy)", async () => {
    const { res } = await req(`${FRONTEND_URL}/login`);
    const h = (n) => res.headers.get(n);
    esperar(/max-age=\d+/.test(h("strict-transport-security") || ""), "falta Strict-Transport-Security");
    esperar((h("x-content-type-options") || "").toLowerCase() === "nosniff", "falta X-Content-Type-Options: nosniff");
    esperar(/^(deny|sameorigin)$/i.test(h("x-frame-options") || ""), "falta X-Frame-Options");
    esperar(!!h("referrer-policy"), "falta Referrer-Policy");
  });

  await teste("Site: Content-Security-Policy publicada (frame-ancestors/object-src)", async () => {
    const { res } = await req(`${FRONTEND_URL}/login`);
    const csp = res.headers.get("content-security-policy") || "";
    esperar(/frame-ancestors/.test(csp) && /object-src/.test(csp), "CSP ausente (ainda nao publicada?)");
  }, { obrigatorio: false });

  // Se a CSP restringe connect-src, ela PRECISA listar a API: senao o navegador bloqueia todas as
  // chamadas e o app "abre mas nao funciona" (acontece ao trocar o endereco da API e esquecer da CSP).
  await teste("Site: CSP (connect-src) libera o endereco da API", async () => {
    const { res } = await req(`${FRONTEND_URL}/login`);
    const csp = res.headers.get("content-security-policy") || "";
    const connect = (csp.match(/connect-src([^;]*)/) || [])[1];
    if (connect === undefined) return "sem connect-src (nao restringe)";
    const origemApi = new URL(API_URL).origin;
    esperar(connect.includes(origemApi), `connect-src nao inclui ${origemApi}: o app nao consegue chamar a API`);
  });

  await teste("Site: manifest.json e service-worker.js disponiveis", async () => {
    const m = await req(`${FRONTEND_URL}/manifest.json`);
    esperar(m.res.status === 200 && m.json && m.json.name, "manifest.json invalido");
    const s = await req(`${FRONTEND_URL}/service-worker.js`);
    esperar(s.res.status === 200, `service-worker.js status ${s.res.status}`);
  });

  await teste("Site: config.js aponta para a API esperada", async () => {
    const { res, texto } = await req(`${FRONTEND_URL}/js/config.js`);
    esperar(res.status === 200, `status ${res.status}`);
    const host = new URL(API_URL).host;
    esperar(texto.includes(host), `config.js nao cita ${host} (frontend apontando para outra API?)`);
  });

  // ---------------- API ----------------
  await teste("API: /api/health responde ok em producao e sem lentidao", async () => {
    const { res, json, ms } = await req(`${API_URL}/api/health`);
    esperar(res.status === 200, `status ${res.status}`);
    esperar(json && json.status === "ok", "corpo inesperado");
    esperar(json.ambiente === "production", `ambiente = ${json.ambiente}`);
    esperar(ms < LENTO_MS, `lento: ${ms} ms (limite ${LENTO_MS} ms)`);
    return `${ms} ms`;
  });

  await teste("API: /api/health/ready confirma o banco", async () => {
    const { res, json } = await req(`${API_URL}/api/health/ready`);
    esperar(res.status !== 404, "rota ainda nao publicada (esperado ate o proximo deploy)");
    esperar(res.status === 200 && json && json.banco === "ok", `status ${res.status}`);
  }, { obrigatorio: false });

  await teste("API: cabecalhos de seguranca e sem X-Powered-By", async () => {
    const { res } = await req(`${API_URL}/api/health`);
    esperar(!res.headers.get("x-powered-by"), "X-Powered-By exposto");
    esperar((res.headers.get("x-content-type-options") || "").toLowerCase() === "nosniff", "falta nosniff");
  });

  await teste("CORS: libera o frontend oficial (preflight)", async () => {
    const { res } = await req(`${API_URL}/api/auth/login`, {
      method: "OPTIONS",
      headers: { Origin: FRONTEND_URL, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    });
    esperar(res.status === 204 || res.status === 200, `status ${res.status}`);
    esperar(res.headers.get("access-control-allow-origin") === FRONTEND_URL,
      `Allow-Origin = ${res.headers.get("access-control-allow-origin")} (FRONTEND_URL do backend nao bate com o site?)`);
  });

  await teste("CORS: NAO libera origem estranha", async () => {
    const { res } = await req(`${API_URL}/api/health`, { headers: { Origin: "https://site-intruso.example" } });
    esperar(!res.headers.get("access-control-allow-origin"), "Allow-Origin devolvido para origem estranha");
  });

  await teste("Autenticacao: rota protegida sem token retorna 401", async () => {
    const { res, json } = await req(`${API_URL}/api/categorias`);
    esperar(res.status === 401, `status ${res.status}`);
    esperar(json && json.erro, "sem mensagem de erro em JSON");
  });

  await teste("Login com corpo vazio e' recusado por validacao (422), sem criar nada", async () => {
    const { res, json } = await req(`${API_URL}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    esperar(res.status === 422, `status ${res.status}`);
    esperar(json && json.campos, "sem detalhe dos campos");
  });

  await teste("Rota inexistente: 404 em JSON, sem vazar stack trace", async () => {
    const { res, texto, json } = await req(`${API_URL}/api/rota-que-nao-existe`);
    esperar(res.status === 404, `status ${res.status}`);
    esperar(json && json.erro, "resposta nao e JSON de erro");
    esperar(!/(\bat .*\.js:\d+|node_modules|Error:)/.test(texto), "resposta parece conter stack trace");
  });

  await teste("JSON malformado: 400 amigavel (nao 500)", async () => {
    const { res, json } = await req(`${API_URL}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{ nao e json",
    });
    esperar(res.status === 400, `status ${res.status}`);
    esperar(json && json.erro, "sem mensagem");
  });

  // ---------------- Relatorio ----------------
  const largura = Math.max(...resultados.map((r) => r.nome.length));
  for (const r of resultados) {
    const marca = r.estado === "OK" ? "[ OK ]" : r.estado === "AVISO" ? "[AVISO]" : "[FALHA]";
    console.log(`${marca} ${r.nome.padEnd(largura)}  ${r.detalhe}`);
  }
  const falhas = resultados.filter((r) => r.estado === "FALHOU").length;
  const avisos = resultados.filter((r) => r.estado === "AVISO").length;
  console.log(`\n${resultados.length - falhas - avisos} ok, ${avisos} aviso(s), ${falhas} falha(s)`);
  process.exit(falhas ? 1 : 0);
})();
