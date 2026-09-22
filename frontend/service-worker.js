"use strict";

// Service worker do Meu Bolso Digital: guarda a "casca" do app (HTML/CSS/JS/icone) pra
// abrir rapido e funcionar offline. Nunca guarda respostas da API (dados financeiros
// tem que vir sempre atualizados do servidor).
const CACHE_NAME = "mbd-cache-v2";
const ARQUIVOS_ESSENCIAIS = [
  "index.html",
  "login.html",
  "cadastro.html",
  "dashboard.html",
  "categorias.html",
  "movimentacoes.html",
  "receitas.html",
  "despesas.html",
  "metas.html",
  "relatorios.html",
  "configuracoes.html",
  "manifest.json",
  "css/global.css",
  "css/layout.css",
  "css/shell.css",
  "css/responsive.css",
  "js/config.js",
  "js/api.js",
  "js/auth.js",
  "js/shell.js",
  "js/movimentacoes.js",
  "js/pwa.js",
  "assets/images/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS))
      .catch(() => {
        // se algum arquivo falhar (ex.: rodando de um path diferente), nao trava a instalacao
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // nunca intercepta POST/PUT/DELETE
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // chamadas pra API seguem direto pra rede

  event.respondWith(
    caches.match(req).then((cacheado) => {
      const buscaNaRede = fetch(req)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          }
          return resposta;
        })
        .catch(() => cacheado);
      return cacheado || buscaNaRede;
    })
  );
});
