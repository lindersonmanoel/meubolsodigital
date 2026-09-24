"use strict";

// Endereco da API. Em localhost aponta pro backend local; em producao aponta pro
// backend publicado no Railway (servico "backend" do projeto "meu-bolso-digital").
window.API_BASE_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "https://backend-production-827d.up.railway.app/api";

// preconnect da API criado a partir do endereco acima (antes era um <link> fixo em todas as paginas:
// trocar de backend exigia editar 15 arquivos). "crossorigin": as chamadas da API sao CORS.
(function () {
  try {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = new URL(window.API_BASE_URL).origin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch (e) { /* sem preconnect a pagina funciona igual */ }
})();
