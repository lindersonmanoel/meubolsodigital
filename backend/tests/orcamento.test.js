"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const { criarUsuarioAutenticado } = require("./helpers");

const app = createApp();

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE orcamentos, recorrencias, metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});
afterAll(async () => pool.end());

async function criarCategoriaDespesa(headers, nome = "Alimentação") {
  const res = await request(app).post("/api/categorias").set(headers).send({ nome, tipo: "despesa" });
  return res.body.categoria.id;
}

describe("orcamentos", () => {
  test("cria um orçamento e calcula o percentual gasto", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const categoriaId = await criarCategoriaDespesa(headers);
    const hoje = new Date().toISOString().slice(0, 10);
    await request(app).post("/api/despesas").set(headers).send({ descricao: "Mercado", valor: 250, data: hoje, categoriaId });

    const criado = await request(app).post("/api/orcamentos").set(headers).send({ categoriaId, valorLimite: 500 });
    expect(criado.status).toBe(201);
    expect(criado.body.orcamento).toMatchObject({ gasto_no_mes: 250, percentual: 50, situacao: "ok" });
  });

  test("marca como 'estourado' quando o gasto passa do limite", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const categoriaId = await criarCategoriaDespesa(headers);
    const hoje = new Date().toISOString().slice(0, 10);
    await request(app).post("/api/despesas").set(headers).send({ descricao: "Mercado", valor: 600, data: hoje, categoriaId });

    const criado = await request(app).post("/api/orcamentos").set(headers).send({ categoriaId, valorLimite: 500 });
    expect(criado.body.orcamento.situacao).toBe("estourado");
  });

  test("não deixa duplicar orçamento pra mesma categoria", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const categoriaId = await criarCategoriaDespesa(headers);
    await request(app).post("/api/orcamentos").set(headers).send({ categoriaId, valorLimite: 500 });
    const duplicado = await request(app).post("/api/orcamentos").set(headers).send({ categoriaId, valorLimite: 300 });
    expect(duplicado.status).toBe(409);
  });

  test("recusa categoria de receita", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const receita = await request(app).post("/api/categorias").set(headers).send({ nome: "Salário", tipo: "receita" });
    const res = await request(app).post("/api/orcamentos").set(headers).send({ categoriaId: receita.body.categoria.id, valorLimite: 500 });
    expect(res.status).toBe(422);
    expect(res.body.campos).toHaveProperty("categoriaId");
  });

  test("atualiza o limite e remove", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const categoriaId = await criarCategoriaDespesa(headers);
    const criado = await request(app).post("/api/orcamentos").set(headers).send({ categoriaId, valorLimite: 500 });
    const id = criado.body.orcamento.id;

    const editado = await request(app).put(`/api/orcamentos/${id}`).set(headers).send({ valorLimite: 800 });
    expect(editado.status).toBe(200);
    expect(Number(editado.body.orcamento.valor_limite)).toBe(800);

    const removido = await request(app).delete(`/api/orcamentos/${id}`).set(headers);
    expect(removido.status).toBe(204);
  });

  test("cada pessoa só vê os próprios orçamentos", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    const categoriaId = await criarCategoriaDespesa(a.headers);
    await request(app).post("/api/orcamentos").set(a.headers).send({ categoriaId, valorLimite: 500 });

    expect((await request(app).get("/api/orcamentos").set(b.headers)).body.orcamentos).toHaveLength(0);
  });

  test("exige autenticação", async () => {
    expect((await request(app).get("/api/orcamentos")).status).toBe(401);
  });
});
