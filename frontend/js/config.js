"use strict";

// Endereco da API. Em localhost aponta pro backend local; troque a segunda linha pelo
// endereco real do seu backend depois de publicar (ex.: "https://api.seudominio.com.br/api").
window.API_BASE_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "https://TROQUE-PELO-ENDERECO-DO-SEU-BACKEND/api";
