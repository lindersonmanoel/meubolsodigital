"use strict";

const rateLimit = require("express-rate-limit");
const config = require("../config");

const JANELA_MS = 15 * 60 * 1000;

/** Fabrica um limitador por IP (janela de 15 min). Em teste o limite sobe muito: os testes fazem
 * centenas de chamadas legitimas; o mecanismo em si e' verificado a parte, com limite baixo. */
function criarLimiter({ limit, mensagem = "Muitas requisições. Aguarde alguns minutos e tente de novo." }) {
  return rateLimit({
    windowMs: JANELA_MS,
    limit: config.isTest ? 100000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: mensagem },
  });
}

// Teto geral por IP pra toda a API (o frontend faz ~5 chamadas por tela; 1000/15 min deixa folga
// pra varias pessoas atras do mesmo IP/NAT e ainda barra script abusivo).
const limiteGeral = criarLimiter({ limit: 1000 });

// Operacoes caras (gerar Excel/CSV, baixar e restaurar backup): bem mais restrito que o geral.
const limitePesado = criarLimiter({
  limit: 30,
  mensagem: "Muitas exportações/backups em pouco tempo. Aguarde alguns minutos e tente de novo.",
});

module.exports = { criarLimiter, limiteGeral, limitePesado };
