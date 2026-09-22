"use strict";

// Service worker do Meu Bolso Digital: guarda a "casca" do app (HTML/CSS/JS/icone) pra
// abrir rapido e funcionar offline. Nunca guarda respostas da API (dados financeiros
// tem que vir sempre atualizados do servidor).
const CACHE_NAME = "mbd-cache-v6";
// URLs "limpas" (sem .html) - e' o que o cleanUrls do vercel.json realmente serve; usar
// esses paths no precache evita cair no redirecionamento 308 (.html -> sem extensao).
const ARQUIVOS_ESSENCIAIS = [
  "/",
  "login",
  "cadastro",
  "dashboard",
  "categorias",
  "movimentacoes",
  "receitas",
  "despesas",
  "metas",
  "relatorios",
  "recorrencias",
  "orcamentos",
  "configuracoes",
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
  "js/tour.js",
  "assets/images/logo-icon.png",
  "assets/images/logo-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          ARQUIVOS_ESSENCIAIS.map((caminho) =>
            fetch(caminho)
              .then((resposta) => Promise.resolve(semRedirecionamento(resposta)))
              .then((final) => cache.put(caminho, final))
              .catch(() => {
                // um arquivo faltando (ex.: rodando de outro path) nao trava a instalacao
              })
          )
        )
      )
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

// O Chrome recusa responder uma navegacao (event.respondWith) com uma Response cujo
// "redirected" seja true (e o Cache API tambem recusa guardar uma assim) - por causa do
// cleanUrls do vercel.json (".html" -> sem extensao), toda resposta que passar por um
// redirecionamento precisa ser reconstruida antes de usar, senao vira ERR_FAILED na tela.
function semRedirecionamento(resposta) {
  if (!resposta.redirected) return resposta;
  return resposta.blob().then(
    (corpo) => new Response(corpo, { status: resposta.status, statusText: resposta.statusText, headers: resposta.headers }),
    () => resposta
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // nunca intercepta POST/PUT/DELETE
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // chamadas pra API seguem direto pra rede

  event.respondWith(
    caches.match(req).then((cacheado) => {
      const buscaNaRede = fetch(req)
        .then((resposta) => {
          if (!resposta || !resposta.ok) return resposta;
          return Promise.resolve(semRedirecionamento(resposta)).then((final) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, final.clone()));
            return final;
          });
        })
        .catch(() => cacheado);
      return cacheado || buscaNaRede;
    })
  );
});
