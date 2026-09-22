"use strict";

const request = require("supertest");

let contador = 0;

/** Cria uma conta nova e devolve { token, usuarioId, headers }, pronta pra usar nos testes. */
async function criarUsuarioAutenticado(app, overrides = {}) {
  contador += 1;
  const dados = {
    nome: overrides.nome || `Usuário Teste ${contador}`,
    email: overrides.email || `usuario${contador}.${Date.now()}@example.com`,
    senha: overrides.senha || "senhaForte123",
  };
  await request(app).post("/api/auth/register").send({ ...dados, confirmarSenha: dados.senha });
  const login = await request(app).post("/api/auth/login").send({ email: dados.email, senha: dados.senha });
  return {
    token: login.body.token,
    usuarioId: login.body.usuario.id,
    headers: { Authorization: `Bearer ${login.body.token}` },
  };
}

module.exports = { criarUsuarioAutenticado };
