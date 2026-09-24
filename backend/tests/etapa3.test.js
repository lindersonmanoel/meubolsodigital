"use strict";

// Correcoes de baixo risco da auditoria: busca com curingas, conflito de unicidade concorrente,
// e-mail unico sem diferenciar caixa e regras de senha (limite do bcrypt + senhas comuns).

const express = require("express");
const request = require("supertest");
const createApp = require("../src/app");
const errorHandler = require("../src/middleware/errorHandler");
const pool = require("../src/database/pool");
const { validarSenhaNova } = require("../src/utils/validators");
const { criarUsuarioAutenticado } = require("./helpers");

const app = createApp();

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});
afterAll(async () => pool.end());

describe("busca por descricao trata % e _ como texto (BUG-09)", () => {
  async function criar(headers, descricao) {
    const res = await request(app).post("/api/despesas").set(headers).send({ descricao, valor: 10, data: "2026-03-05" });
    expect(res.status).toBe(201);
  }
  const buscar = async (headers, termo) =>
    (await request(app).get("/api/movimentacoes").query({ busca: termo }).set(headers)).body.movimentacoes.map((m) => m.descricao).sort();

  test("'50%', '_' e '%' so' casam com quem realmente tem esses caracteres", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    await criar(headers, "Desconto 50% off");
    await criar(headers, "Cinquenta reais");
    await criar(headers, "conta_luz");
    await criar(headers, "Caminho C:\\dados");

    expect(await buscar(headers, "50%")).toEqual(["Desconto 50% off"]);
    expect(await buscar(headers, "%")).toEqual(["Desconto 50% off"]);
    expect(await buscar(headers, "_")).toEqual(["conta_luz"]);
    expect(await buscar(headers, "\\")).toEqual(["Caminho C:\\dados"]);
  });

  test("a busca normal (sem curingas) continua funcionando e ignora maiusculas", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    await criar(headers, "Supermercado Central");
    await criar(headers, "Padaria");
    expect(await buscar(headers, "mercado")).toEqual(["Supermercado Central"]);
  });
});

describe("conflito de unicidade vira 409 e nao 500 (BUG-11)", () => {
  test("errorHandler mapeia o erro 23505 do PostgreSQL para 409", async () => {
    const mini = express();
    mini.get("/x", (_req, _res, next) => next(Object.assign(new Error("duplicate key value"), { code: "23505" })));
    mini.use(errorHandler);
    const res = await request(mini).get("/x");
    expect(res.status).toBe(409);
    expect(res.body.erro).toBe("Esse registro já existe.");
    expect(JSON.stringify(res.body)).not.toMatch(/duplicate key/); // nao vaza detalhe interno
  });

  test("dois cadastros simultaneos do mesmo e-mail: um cria (201) e o outro recebe 409", async () => {
    const corpo = { nome: "Ana", email: "corrida@example.com", senha: "senhaForte123", confirmarSenha: "senhaForte123" };
    const respostas = await Promise.all([1, 2, 3].map(() => request(app).post("/api/auth/register").send(corpo)));
    const status = respostas.map((r) => r.status).sort();
    expect(status).toEqual([201, 409, 409]);
  });

  test("o banco recusa e-mails que so' diferem na caixa (indice unico em lower(email))", async () => {
    await pool.query("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('A', 'Caixa@Example.com', 'x')");
    await expect(pool.query("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('B', 'caixa@example.com', 'x')"))
      .rejects.toMatchObject({ code: "23505" });
  });
});

describe("regras da senha nova (SEG-07)", () => {
  test("validarSenhaNova: minimo, maximo em BYTES e senhas comuns", () => {
    expect(validarSenhaNova("curta")).toMatch(/pelo menos 8/);
    expect(validarSenhaNova("a".repeat(72))).toBeNull();
    expect(validarSenhaNova("a".repeat(73))).toMatch(/72 bytes/);
    expect(validarSenhaNova("ç".repeat(37))).toMatch(/72 bytes/); // 37 caracteres = 74 bytes
    expect(validarSenhaNova("ç".repeat(36))).toBeNull(); // 72 bytes
    expect(validarSenhaNova("12345678")).toMatch(/muito comum/);
    expect(validarSenhaNova("PassWord")).toMatch(/muito comum/); // a lista ignora maiusculas ("password")
    expect(validarSenhaNova("SENHA123")).toMatch(/muito comum/); // idem ("senha123")
    expect(validarSenhaNova("Zebra-Azul-42")).toBeNull(); // 13 caracteres, fora da lista
  });

  test("cadastro recusa senha acima de 72 bytes e senha comum; aceita exatamente 72", async () => {
    const tentar = (senha) => request(app).post("/api/auth/register")
      .send({ nome: "Ana", email: `s${Math.random().toString(36).slice(2)}@example.com`, senha, confirmarSenha: senha });
    const longa = await tentar("a".repeat(73));
    expect(longa.status).toBe(422);
    expect(longa.body.campos.senha).toMatch(/72 bytes/);
    const comum = await tentar("12345678");
    expect(comum.status).toBe(422);
    expect(comum.body.campos.senha).toMatch(/muito comum/);
    expect((await tentar("a".repeat(72))).status).toBe(201);
  });

  test("trocar a senha aplica as mesmas regras (mensagem diz 'nova senha')", async () => {
    const { headers } = await criarUsuarioAutenticado(app, { senha: "senhaForte123" });
    const res = await request(app).put("/api/users/senha").set(headers)
      .send({ senhaAtual: "senhaForte123", novaSenha: "12345678", confirmarNovaSenha: "12345678" });
    expect(res.status).toBe(422);
    expect(res.body.campos.novaSenha).toMatch(/^A nova senha|comum/);
    const longa = await request(app).put("/api/users/senha").set(headers)
      .send({ senhaAtual: "senhaForte123", novaSenha: "b".repeat(80), confirmarNovaSenha: "b".repeat(80) });
    expect(longa.status).toBe(422);
    expect(longa.body.campos.novaSenha).toMatch(/72 bytes/);
  });

  test("quem ja tem senha antiga longa (ate 200) continua conseguindo entrar", async () => {
    // contas criadas antes desta regra podem ter senha > 72 bytes; o bcrypt compara so' os 72 primeiros.
    // O hash e' gerado com o bcryptjs (biblioteca ANTIGA): prova que o bcrypt nativo le os hashes ja gravados.
    const bcrypt = require("bcryptjs");
    const senha = "s".repeat(150);
    const hash = await bcrypt.hash(senha, 4);
    await pool.query("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('Antiga', 'antiga@example.com', $1)", [hash]);
    const login = await request(app).post("/api/auth/login").send({ email: "antiga@example.com", senha });
    expect(login.status).toBe(200);
  });
});
