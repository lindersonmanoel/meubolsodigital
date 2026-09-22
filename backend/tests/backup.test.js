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

async function popularConta(headers) {
  const categoria = await request(app).post("/api/categorias").set(headers).send({ nome: "Mercado", tipo: "despesa" });
  await request(app).post("/api/despesas").set(headers).send({
    descricao: "Compras", valor: 150, data: "2026-01-10", categoriaId: categoria.body.categoria.id, observacao: "mensal",
  });
  await request(app).post("/api/receitas").set(headers).send({ descricao: "Salário", valor: 3000, data: "2026-01-05" });
  await request(app).post("/api/metas").set(headers).send({ nome: "Viagem", valorObjetivo: 5000, valorAtual: 1000, prazo: "2026-12-31" });
  await request(app).post("/api/orcamentos").set(headers).send({ categoriaId: categoria.body.categoria.id, valorLimite: 500 });
  await request(app).post("/api/recorrencias").set(headers).send({ tipo: "despesa", descricao: "Aluguel", valor: 1200, diaMes: 5, categoriaId: categoria.body.categoria.id });
}

describe("backup", () => {
  test("exporta tudo num unico arquivo, com data formatada e categorias por nome", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    await popularConta(headers);

    const res = await request(app).get("/api/backup").set(headers);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain(".json");
    expect(res.body.versao).toBe(1);
    expect(res.body.categorias).toEqual([{ nome: "Mercado", tipo: "despesa" }]);
    expect(res.body.movimentacoes).toHaveLength(2);
    const despesa = res.body.movimentacoes.find((m) => m.tipo === "despesa");
    expect(despesa).toMatchObject({ descricao: "Compras", valor: 150, data: "2026-01-10", categoriaNome: "Mercado" });
    expect(res.body.metas).toHaveLength(1);
    expect(res.body.orcamentos).toEqual([{ categoriaNome: "Mercado", valorLimite: 500 }]);
    expect(res.body.recorrencias).toHaveLength(1);
  });

  test("restaura o backup numa conta nova (recria categorias pelo nome e religa tudo)", async () => {
    const origem = await criarUsuarioAutenticado(app);
    await popularConta(origem.headers);
    const backup = (await request(app).get("/api/backup").set(origem.headers)).body;

    const destino = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/backup/restaurar").set(destino.headers).send(backup);
    expect(res.status).toBe(200);
    expect(res.body.resultado).toMatchObject({ categorias: 1, movimentacoes: 2, metas: 1, orcamentos: 1, recorrencias: 1 });

    const categorias = (await request(app).get("/api/categorias").set(destino.headers)).body.categorias;
    expect(categorias).toHaveLength(1);
    const movimentacoes = (await request(app).get("/api/movimentacoes").set(destino.headers)).body.movimentacoes;
    expect(movimentacoes).toHaveLength(2);
    const despesaRestaurada = movimentacoes.find((m) => m.tipo === "despesa");
    expect(despesaRestaurada.categoria_nome).toBe("Mercado"); // religou pela categoria recriada, nao pelo id antigo
  });

  test("restaurar duas vezes nao duplica categoria, mas duplica movimentacoes (e' importar, nao sincronizar)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    await popularConta(headers);
    const backup = (await request(app).get("/api/backup").set(headers)).body;

    await request(app).post("/api/backup/restaurar").set(headers).send(backup);

    const categorias = (await request(app).get("/api/categorias").set(headers)).body.categorias;
    expect(categorias).toHaveLength(1); // categoria "Mercado" ja existia, nao duplicou

    const movimentacoes = (await request(app).get("/api/movimentacoes").set(headers)).body.movimentacoes;
    expect(movimentacoes).toHaveLength(4); // 2 originais + 2 do backup restaurado por cima
  });

  test("rejeita arquivo que nao e' um backup valido", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/backup/restaurar").set(headers).send({ isso: "nao e um backup" });
    expect(res.status).toBe(422);
  });

  test("exige autenticação", async () => {
    expect((await request(app).get("/api/backup")).status).toBe(401);
    expect((await request(app).post("/api/backup/restaurar").send({})).status).toBe(401);
  });
});
