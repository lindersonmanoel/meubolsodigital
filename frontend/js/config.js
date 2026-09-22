"use strict";

// Endereco da API. Em localhost aponta pro backend local; em producao aponta pro
// backend publicado no Railway (servico "backend" do projeto "meu-bolso-digital").
window.API_BASE_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "https://backend-production-827d.up.railway.app/api";
