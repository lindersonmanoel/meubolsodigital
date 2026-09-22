"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const { criarUsuarioAutenticado } = require("./helpers");

const app = createApp();

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});
afterAll(async () => pool.end());

describe("categorias", () => {
  test("cria, lista, atualiza e remove uma categoria", async () => {
    const { headers } = await criarUsuarioAutenticado(app);

    const criada = await request(app).post("/api/categorias").set(headers).send({ nome: "Alimentação", tipo: "despesa" });
    expect(criada.status).toBe(201);
    expect(criada.body.categoria).toMatchObject({ nome: "Alimentação", tipo: "despesa" });

    const lista = await request(app).get("/api/categorias").set(headers);
    expect(lista.body.categorias).toHaveLength(1);

    const id = criada.body.categoria.id;
    const editada = await request(app).put(`/api/categorias/${id}`).set(headers).send({ nome: "Mercado", tipo: "despesa" });
    expect(editada.status).toBe(200);
    expect(editada.body.categoria.nome).toBe("Mercado");

    const removida = await request(app).delete(`/api/categorias/${id}`).set(headers);
    expect(removida.status).toBe(204);
    expect((await request(app).get("/api/categorias").set(headers)).body.categorias).toHaveLength(0);
  });

  test("exige autenticação", async () => {
    expect((await request(app).get("/api/categorias")).status).toBe(401);
  });

  test.each([
    [{ nome: "", tipo: "despesa" }, "nome"],
    [{ nome: "Ok", tipo: "invalido" }, "tipo"],
  ])("rejeita dados inválidos: %j", async (payload, campo) => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/categorias").set(headers).send(payload);
    expect(res.status).toBe(422);
    expect(res.body.campos).toHaveProperty(campo);
  });

  test("não deixa duplicar nome+tipo da mesma pessoa, mas permite em pessoas diferentes", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    await request(app).post("/api/categorias").set(a.headers).send({ nome: "Lazer", tipo: "despesa" });

    const duplicada = await request(app).post("/api/categorias").set(a.headers).send({ nome: "lazer", tipo: "despesa" });
    expect(duplicada.status).toBe(409);

    const outroTipo = await request(app).post("/api/categorias").set(a.headers).send({ nome: "Lazer", tipo: "receita" });
    expect(outroTipo.status).toBe(201);

    const outraPessoa = await request(app).post("/api/categorias").set(b.headers).send({ nome: "Lazer", tipo: "despesa" });
    expect(outraPessoa.status).toBe(201);
  });

  test("não deixa trocar o tipo de uma categoria que já tem movimentação (evita dado inconsistente)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/categorias").set(headers).send({ nome: "Mercado", tipo: "despesa" });
    const id = criada.body.categoria.id;
    await request(app).post("/api/movimentacoes").set(headers).send({
      tipo: "despesa", descricao: "Compras", valor: 50, data: "2026-01-01", categoriaId: id,
    });

    const trocaTipo = await request(app).put(`/api/categorias/${id}`).set(headers).send({ nome: "Mercado", tipo: "receita" });
    expect(trocaTipo.status).toBe(409);

    const soRenomeia = await request(app).put(`/api/categorias/${id}`).set(headers).send({ nome: "Mercado e Feira", tipo: "despesa" });
    expect(soRenomeia.status).toBe(200);
  });

  test("cada pessoa só vê e mexe nas próprias categorias", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/categorias").set(a.headers).send({ nome: "Só da A", tipo: "despesa" });
    const id = criada.body.categoria.id;

    expect((await request(app).get("/api/categorias").set(b.headers)).body.categorias).toHaveLength(0);
    expect((await request(app).put(`/api/categorias/${id}`).set(b.headers).send({ nome: "Outro nome", tipo: "despesa" })).status).toBe(404);
    expect((await request(app).delete(`/api/categorias/${id}`).set(b.headers)).status).toBe(404);
  });

  test("id inválido na rota vira 400, não 500", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).put("/api/categorias/nao-e-numero").set(headers).send({ nome: "X", tipo: "despesa" });
    expect(res.status).toBe(400);
  });
});
