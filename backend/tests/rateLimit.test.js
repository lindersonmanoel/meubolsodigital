"use strict";

// Testa o MECANISMO do limitador isoladamente, com um limite bem baixo, montado na mao
// (nao usa o app real nem o limite alto de config.isTest) - assim nao interfere nos
// outros testes e nao precisa de 20+ requisicoes so pra provar que o bloqueio funciona.
const express = require("express");
const request = require("supertest");
const rateLimit = require("express-rate-limit");

function buildAppComLimiteBaixo() {
  const app = express();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
  });
  app.post("/api/auth/login", limiter, (_req, res) => res.status(401).json({ erro: "E-mail ou senha invalidos." }));
  return app;
}

test("bloqueia com 429 depois de exceder o limite de tentativas do mesmo IP", async () => {
  const app = buildAppComLimiteBaixo();
  const respostas = [];
  for (let i = 0; i < 4; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    respostas.push(await request(app).post("/api/auth/login").send({}));
  }
  expect(respostas.slice(0, 3).map((r) => r.status)).toEqual([401, 401, 401]);
  expect(respostas[3].status).toBe(429);
  expect(respostas[3].body.erro).toMatch(/muitas tentativas/i);
});
