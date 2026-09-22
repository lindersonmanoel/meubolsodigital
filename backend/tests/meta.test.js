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

describe("metas", () => {
  test("cria uma meta e calcula o progresso", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/metas").set(headers).send({
      nome: "Notebook novo", valorObjetivo: 5000, valorAtual: 2000, prazo: "2026-12-31",
    });
    expect(criada.status).toBe(201);
    expect(criada.body.meta.progresso).toBe(40);
  });

  test("progresso nunca passa de 100%, mesmo ultrapassando o objetivo (seção 27)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/metas").set(headers).send({
      nome: "Meta batida", valorObjetivo: 1000, valorAtual: 5000,
    });
    expect(criada.body.meta.progresso).toBe(100);
  });

  test("valor atual sem informar começa em zero (0% de progresso)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/metas").set(headers).send({ nome: "Do zero", valorObjetivo: 1000 });
    expect(criada.body.meta.valor_atual).toBe(0);
    expect(criada.body.meta.progresso).toBe(0);
  });

  test("atualiza o valor atual (registrar progresso) e recalcula", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/metas").set(headers).send({ nome: "Viagem", valorObjetivo: 2000 });
    const id = criada.body.meta.id;
    const editada = await request(app).put(`/api/metas/${id}`).set(headers).send({
      nome: "Viagem", valorObjetivo: 2000, valorAtual: 1000,
    });
    expect(editada.body.meta.progresso).toBe(50);
  });

  test.each([
    [{ nome: "", valorObjetivo: 100 }, "nome"],
    [{ nome: "X", valorObjetivo: 0 }, "valorObjetivo"],
    [{ nome: "X", valorObjetivo: 100, valorAtual: -1 }, "valorAtual"],
    [{ nome: "X", valorObjetivo: 100, prazo: "31/12/2026" }, "prazo"],
  ])("rejeita dados inválidos: %j", async (payload) => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/metas").set(headers).send(payload);
    expect(res.status).toBe(422);
  });

  test("remove uma meta e isola por usuário", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/metas").set(a.headers).send({ nome: "Só da A", valorObjetivo: 100 });
    const id = criada.body.meta.id;

    expect((await request(app).get("/api/metas").set(b.headers)).body.metas).toHaveLength(0);
    expect((await request(app).delete(`/api/metas/${id}`).set(b.headers)).status).toBe(404);
    expect((await request(app).delete(`/api/metas/${id}`).set(a.headers)).status).toBe(204);
  });
});
