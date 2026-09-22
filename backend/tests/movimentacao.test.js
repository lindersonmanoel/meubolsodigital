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

async function criarCategoria(headers, tipo = "despesa", nome = "Mercado") {
  const res = await request(app).post("/api/categorias").set(headers).send({ nome, tipo });
  return res.body.categoria.id;
}

describe("movimentacoes", () => {
  test("cria, lista, atualiza e remove uma movimentação", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const categoriaId = await criarCategoria(headers);

    const criada = await request(app).post("/api/movimentacoes").set(headers).send({
      tipo: "despesa", descricao: "Compras do mês", valor: 250.5, data: "2026-01-10", categoriaId,
    });
    expect(criada.status).toBe(201);
    expect(criada.body.movimentacao).toMatchObject({
      descricao: "Compras do mês", tipo: "despesa", categoria_nome: "Mercado",
    });
    expect(Number(criada.body.movimentacao.valor)).toBe(250.5);

    const id = criada.body.movimentacao.id;
    const editada = await request(app).put(`/api/movimentacoes/${id}`).set(headers).send({
      tipo: "despesa", descricao: "Compras revisadas", valor: 300, data: "2026-01-11",
    });
    expect(editada.status).toBe(200);
    expect(editada.body.movimentacao.descricao).toBe("Compras revisadas");
    expect(editada.body.movimentacao.categoria_id).toBeNull(); // tirou a categoria no update

    const lista = await request(app).get("/api/movimentacoes").set(headers);
    expect(lista.body.movimentacoes).toHaveLength(1);

    const removida = await request(app).delete(`/api/movimentacoes/${id}`).set(headers);
    expect(removida.status).toBe(204);
  });

  test.each([
    [{ tipo: "despesa", descricao: "", valor: 10, data: "2026-01-01" }, "descricao"],
    [{ tipo: "despesa", descricao: "X", valor: 0, data: "2026-01-01" }, "valor"],
    [{ tipo: "despesa", descricao: "X", valor: -5, data: "2026-01-01" }, "valor"],
    [{ tipo: "despesa", descricao: "X", valor: 10, data: "31/01/2026" }, "data"],
    [{ tipo: "outro", descricao: "X", valor: 10, data: "2026-01-01" }, "tipo"],
  ])("rejeita dados inválidos: %j", async (payload) => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/movimentacoes").set(headers).send(payload);
    expect(res.status).toBe(422);
  });

  test("recusa categoria de outro usuário e categoria do tipo errado", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    const categoriaDeB = await criarCategoria(b.headers, "despesa");
    const categoriaReceita = await criarCategoria(a.headers, "receita", "Salário");

    const comCategoriaAlheia = await request(app).post("/api/movimentacoes").set(a.headers).send({
      tipo: "despesa", descricao: "X", valor: 10, data: "2026-01-01", categoriaId: categoriaDeB,
    });
    expect(comCategoriaAlheia.status).toBe(422);
    expect(comCategoriaAlheia.body.campos).toHaveProperty("categoriaId");

    const tipoErrado = await request(app).post("/api/movimentacoes").set(a.headers).send({
      tipo: "despesa", descricao: "X", valor: 10, data: "2026-01-01", categoriaId: categoriaReceita,
    });
    expect(tipoErrado.status).toBe(422);
    expect(tipoErrado.body.campos.categoriaId).toMatch(/receita/);
  });

  test("cada pessoa só vê e mexe nas próprias movimentações", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    const criada = await request(app).post("/api/movimentacoes").set(a.headers).send({
      tipo: "receita", descricao: "Só da A", valor: 100, data: "2026-01-01",
    });
    const id = criada.body.movimentacao.id;

    expect((await request(app).get("/api/movimentacoes").set(b.headers)).body.movimentacoes).toHaveLength(0);
    expect((await request(app).delete(`/api/movimentacoes/${id}`).set(b.headers)).status).toBe(404);
  });

  describe("filtros", () => {
    async function popular(headers) {
      const alimentacao = await criarCategoria(headers, "despesa", "Alimentação");
      await request(app).post("/api/movimentacoes").set(headers).send({
        tipo: "despesa", descricao: "Mercado janeiro", valor: 100, data: "2026-01-05", categoriaId: alimentacao,
      });
      await request(app).post("/api/movimentacoes").set(headers).send({
        tipo: "despesa", descricao: "Farmácia janeiro", valor: 50, data: "2026-01-20",
      });
      await request(app).post("/api/movimentacoes").set(headers).send({
        tipo: "receita", descricao: "Salário janeiro", valor: 3000, data: "2026-01-05",
      });
      await request(app).post("/api/movimentacoes").set(headers).send({
        tipo: "despesa", descricao: "Mercado fevereiro", valor: 120, data: "2026-02-05", categoriaId: alimentacao,
      });
      return { alimentacao };
    }

    test("filtra por tipo", async () => {
      const { headers } = await criarUsuarioAutenticado(app);
      await popular(headers);
      const res = await request(app).get("/api/movimentacoes?tipo=receita").set(headers);
      expect(res.body.movimentacoes).toHaveLength(1);
      expect(res.body.movimentacoes[0].tipo).toBe("receita");
    });

    test("filtra por período (inicio/fim)", async () => {
      const { headers } = await criarUsuarioAutenticado(app);
      await popular(headers);
      const res = await request(app).get("/api/movimentacoes?inicio=2026-01-01&fim=2026-01-31").set(headers);
      expect(res.body.movimentacoes).toHaveLength(3);
    });

    test("filtra por categoria", async () => {
      const { headers } = await criarUsuarioAutenticado(app);
      const { alimentacao } = await popular(headers);
      const res = await request(app).get(`/api/movimentacoes?categoriaId=${alimentacao}`).set(headers);
      expect(res.body.movimentacoes).toHaveLength(2);
    });

    test("busca por descrição", async () => {
      const { headers } = await criarUsuarioAutenticado(app);
      await popular(headers);
      const res = await request(app).get("/api/movimentacoes?busca=farm").set(headers);
      expect(res.body.movimentacoes).toHaveLength(1);
      expect(res.body.movimentacoes[0].descricao).toMatch(/Farmácia/);
    });

    test("GET /api/receitas e /api/despesas já vêm pré-filtrados por tipo", async () => {
      const { headers } = await criarUsuarioAutenticado(app);
      await popular(headers);
      const receitas = await request(app).get("/api/receitas").set(headers);
      expect(receitas.body.movimentacoes.every((m) => m.tipo === "receita")).toBe(true);
      const despesas = await request(app).get("/api/despesas").set(headers);
      expect(despesas.body.movimentacoes.every((m) => m.tipo === "despesa")).toBe(true);
      expect(despesas.body.movimentacoes.length).toBe(3);
    });

    test("exporta em Excel (.xlsx)", async () => {
      const { headers } = await criarUsuarioAutenticado(app);
      await popular(headers);
      const res = await request(app).get("/api/movimentacoes/exportar-excel").set(headers);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(res.headers["content-disposition"]).toContain(".xlsx");
    });

    test("POST /api/receitas força o tipo, mesmo se o corpo mandar outro", async () => {
      const { headers } = await criarUsuarioAutenticado(app);
      const res = await request(app).post("/api/receitas").set(headers).send({
        tipo: "despesa", descricao: "Forçado", valor: 10, data: "2026-01-01",
      });
      expect(res.status).toBe(201);
      expect(res.body.movimentacao.tipo).toBe("receita");
    });
  });
});
