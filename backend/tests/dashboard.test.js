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

function hoje(diaFixo) {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${diaFixo}`;
}

describe("dashboard", () => {
  test("resumo: saldo = receitas - despesas (todas as movimentações)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    await request(app).post("/api/movimentacoes").set(headers).send({ tipo: "receita", descricao: "Salário", valor: 3000, data: hoje("05") });
    await request(app).post("/api/movimentacoes").set(headers).send({ tipo: "despesa", descricao: "Aluguel", valor: 1200, data: hoje("10") });

    const res = await request(app).get("/api/dashboard/resumo").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.saldoAtual).toBe(1800);
    expect(res.body.receitasDoMes).toBe(3000);
    expect(res.body.despesasDoMes).toBe(1200);
    expect(res.body.resultadoDoMes).toBe(1800);
  });

  test("resumo não mistura dados de usuários diferentes", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    await request(app).post("/api/movimentacoes").set(a.headers).send({ tipo: "receita", descricao: "A", valor: 1000, data: hoje("05") });
    await request(app).post("/api/movimentacoes").set(b.headers).send({ tipo: "receita", descricao: "B", valor: 500, data: hoje("05") });

    const resA = await request(app).get("/api/dashboard/resumo").set(a.headers);
    expect(resA.body.saldoAtual).toBe(1000);
  });

  test("graficos: agrupa por mes e despesas por categoria", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const catRes = await request(app).post("/api/categorias").set(headers).send({ nome: "Alimentação", tipo: "despesa" });
    await request(app).post("/api/movimentacoes").set(headers).send({
      tipo: "despesa", descricao: "Mercado", valor: 300, data: hoje("05"), categoriaId: catRes.body.categoria.id,
    });

    const res = await request(app).get("/api/dashboard/graficos?meses=3").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.porMes).toHaveLength(3);
    expect(res.body.despesasPorCategoriaNoMes[0]).toMatchObject({ categoria: "Alimentação", total: 300 });
  });

  test("exige autenticação", async () => {
    expect((await request(app).get("/api/dashboard/resumo")).status).toBe(401);
    expect((await request(app).get("/api/dashboard/graficos")).status).toBe(401);
  });
});

describe("relatorios", () => {
  test("calcula totais, saldo, quantidade e categoria com maior gasto", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const alimentacao = await request(app).post("/api/categorias").set(headers).send({ nome: "Alimentação", tipo: "despesa" });
    const transporte = await request(app).post("/api/categorias").set(headers).send({ nome: "Transporte", tipo: "despesa" });
    await request(app).post("/api/movimentacoes").set(headers).send({ tipo: "receita", descricao: "Salário", valor: 3000, data: "2026-03-01" });
    await request(app).post("/api/movimentacoes").set(headers).send({ tipo: "despesa", descricao: "Mercado", valor: 500, data: "2026-03-05", categoriaId: alimentacao.body.categoria.id });
    await request(app).post("/api/movimentacoes").set(headers).send({ tipo: "despesa", descricao: "Uber", valor: 100, data: "2026-03-06", categoriaId: transporte.body.categoria.id });

    const res = await request(app).get("/api/relatorios?inicio=2026-03-01&fim=2026-03-31").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.totalReceitas).toBe(3000);
    expect(res.body.totalDespesas).toBe(600);
    expect(res.body.saldoNoPeriodo).toBe(2400);
    expect(res.body.quantidadeMovimentacoes).toBe(3);
    expect(res.body.categoriaComMaiorGasto).toMatchObject({ categoria: "Alimentação", total: 500 });
  });

  test("periodo fora do informado nao entra no relatorio", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    await request(app).post("/api/movimentacoes").set(headers).send({ tipo: "receita", descricao: "Fora", valor: 999, data: "2020-01-01" });
    const res = await request(app).get("/api/relatorios?inicio=2026-01-01&fim=2026-12-31").set(headers);
    expect(res.body.totalReceitas).toBe(0);
  });

  test("exporta o relatorio completo em Excel (.xlsx), com varias abas", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const categoria = await request(app).post("/api/categorias").set(headers).send({ nome: "Mercado", tipo: "despesa" });
    await request(app).post("/api/despesas").set(headers).send({
      descricao: "Compras", valor: 100, data: "2026-03-05", categoriaId: categoria.body.categoria.id,
    });
    await request(app).post("/api/metas").set(headers).send({ nome: "Viagem", valorObjetivo: 1000, valorAtual: 200 });
    await request(app).post("/api/orcamentos").set(headers).send({ categoriaId: categoria.body.categoria.id, valorLimite: 500 });

    const res = await request(app).get("/api/relatorios/exportar-excel?inicio=2026-03-01&fim=2026-03-31").set(headers);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers["content-disposition"]).toContain(".xlsx");
  });
});
