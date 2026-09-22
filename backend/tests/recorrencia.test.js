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

describe("recorrencias", () => {
  test("cria, lista, atualiza e remove uma recorrência", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/recorrencias").set(headers).send({
      tipo: "despesa", descricao: "Aluguel", valor: 1500, diaMes: 5,
    });
    expect(criada.status).toBe(201);
    expect(criada.body.recorrencia).toMatchObject({ descricao: "Aluguel", tipo: "despesa", dia_mes: 5, ativa: true });

    const lista = await request(app).get("/api/recorrencias").set(headers);
    expect(lista.body.recorrencias).toHaveLength(1);

    const id = criada.body.recorrencia.id;
    const editada = await request(app).put(`/api/recorrencias/${id}`).set(headers).send({
      tipo: "despesa", descricao: "Aluguel reajustado", valor: 1600, diaMes: 10, ativa: false,
    });
    expect(editada.status).toBe(200);
    expect(editada.body.recorrencia).toMatchObject({ descricao: "Aluguel reajustado", dia_mes: 10, ativa: false });

    const removida = await request(app).delete(`/api/recorrencias/${id}`).set(headers);
    expect(removida.status).toBe(204);
  });

  test.each([
    [{ tipo: "despesa", descricao: "", valor: 10, diaMes: 5 }, "descricao"],
    [{ tipo: "despesa", descricao: "X", valor: 0, diaMes: 5 }, "valor"],
    [{ tipo: "despesa", descricao: "X", valor: 10, diaMes: 0 }, "diaMes"],
    [{ tipo: "despesa", descricao: "X", valor: 10, diaMes: 29 }, "diaMes"],
    [{ tipo: "invalido", descricao: "X", valor: 10, diaMes: 5 }, "tipo"],
  ])("rejeita dados inválidos: %j", async (payload, campo) => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/recorrencias").set(headers).send(payload);
    expect(res.status).toBe(422);
    expect(res.body.campos).toHaveProperty(campo);
  });

  test("cada pessoa só vê e mexe nas próprias recorrências", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/recorrencias").set(a.headers).send({ tipo: "despesa", descricao: "Só da A", valor: 10, diaMes: 5 });
    const id = criada.body.recorrencia.id;

    expect((await request(app).get("/api/recorrencias").set(b.headers)).body.recorrencias).toHaveLength(0);
    expect((await request(app).delete(`/api/recorrencias/${id}`).set(b.headers)).status).toBe(404);
  });

  test("gera a movimentação do mês automaticamente quando o dashboard é aberto (dia já chegou)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const hoje = new Date();
    // dia_mes no passado/hoje dentro do mes, pra garantir que ja "chegou a vez" dela
    const diaMes = Math.max(1, Math.min(28, hoje.getDate()));
    await request(app).post("/api/recorrencias").set(headers).send({ tipo: "receita", descricao: "Salário", valor: 3000, diaMes });

    const resumo = await request(app).get("/api/dashboard/resumo").set(headers);
    expect(resumo.status).toBe(200);
    expect(resumo.body.saldoAtual).toBe(3000);

    const movimentacoes = await request(app).get("/api/movimentacoes").set(headers);
    expect(movimentacoes.body.movimentacoes).toHaveLength(1);
    expect(movimentacoes.body.movimentacoes[0].descricao).toBe("Salário");

    // Abrir de novo nao duplica.
    await request(app).get("/api/dashboard/resumo").set(headers);
    const movimentacoesDeNovo = await request(app).get("/api/movimentacoes").set(headers);
    expect(movimentacoesDeNovo.body.movimentacoes).toHaveLength(1);
  });

  test("recorrência inativa não gera movimentação", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const hoje = new Date();
    const diaMes = Math.max(1, Math.min(28, hoje.getDate()));
    await request(app).post("/api/recorrencias").set(headers).send({ tipo: "receita", descricao: "Pausada", valor: 100, diaMes, ativa: false });

    await request(app).get("/api/dashboard/resumo").set(headers);
    const movimentacoes = await request(app).get("/api/movimentacoes").set(headers);
    expect(movimentacoes.body.movimentacoes).toHaveLength(0);
  });

  test("exige autenticação", async () => {
    expect((await request(app).get("/api/recorrencias")).status).toBe(401);
  });
});
