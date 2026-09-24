"use strict";

// Testes das correcoes da auditoria (etapa 1): datas inexistentes, valores acima do limite,
// validacao do perfil/e-mail e rotas /receitas e /despesas que so' mexem no proprio tipo.

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const { criarUsuarioAutenticado } = require("./helpers");

const app = createApp();

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});
afterAll(async () => pool.end());

const despesa = (data) => ({ tipo: "despesa", descricao: "Teste", valor: 10, data });

describe("datas que nao existem no calendario (antes: erro 500)", () => {
  test("recusa 31/02 e 29/02 de ano nao bissexto com 422 (e nao 500)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    for (const data of ["2026-02-31", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10"]) {
      const res = await request(app).post("/api/movimentacoes").set(headers).send(despesa(data));
      expect([data, res.status]).toEqual([data, 422]);
      expect(res.body.campos.data).toBeDefined();
    }
  });

  test("aceita 29/02 de ano bissexto", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/movimentacoes").set(headers).send(despesa("2028-02-29"));
    expect(res.status).toBe(201);
  });

  test("prazo de meta inexistente vira 422", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/metas").set(headers).send({ nome: "Viagem", valorObjetivo: 1000, prazo: "2026-04-31" });
    expect(res.status).toBe(422);
    expect(res.body.campos.prazo).toBeDefined();
  });

  test("filtros de periodo com data inexistente sao ignorados (200, nao 500)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    expect((await request(app).get("/api/movimentacoes?inicio=2026-02-31").set(headers)).status).toBe(200);
    expect((await request(app).get("/api/despesas?fim=2026-13-01").set(headers)).status).toBe(200);
    expect((await request(app).get("/api/relatorios?inicio=2026-02-31&fim=2026-02-30").set(headers)).status).toBe(200);
  });
});

describe("valores acima do que cabe em NUMERIC(12,2) (antes: erro 500)", () => {
  test("meta: objetivo e valor atual gigantes viram 422", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const objetivo = await request(app).post("/api/metas").set(headers).send({ nome: "Grande", valorObjetivo: 1e12 });
    expect(objetivo.status).toBe(422);
    expect(objetivo.body.campos.valorObjetivo).toBeDefined();
    const atual = await request(app).post("/api/metas").set(headers).send({ nome: "Grande", valorObjetivo: 100, valorAtual: 1e12 });
    expect(atual.status).toBe(422);
    expect(atual.body.campos.valorAtual).toBeDefined();
  });

  test("meta: o valor maximo permitido ainda funciona", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/metas").set(headers).send({ nome: "Maxima", valorObjetivo: 999999999.99 });
    expect(res.status).toBe(201);
  });

  test("orcamento: limite gigante vira 422; o maximo funciona", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const cat = await request(app).post("/api/categorias").set(headers).send({ nome: "Mercado", tipo: "despesa" });
    const categoriaId = cat.body.categoria.id;
    const grande = await request(app).post("/api/orcamentos").set(headers).send({ categoriaId, valorLimite: 1e12 });
    expect(grande.status).toBe(422);
    expect(grande.body.campos.valorLimite).toBeDefined();
    const ok = await request(app).post("/api/orcamentos").set(headers).send({ categoriaId, valorLimite: 999999999.99 });
    expect(ok.status).toBe(201);
  });
});

describe("perfil e e-mail (antes: 500 em nome longo, e-mail invalido aceito, HTML no e-mail)", () => {
  test("PUT /users/me valida tamanho do nome e formato/tamanho do e-mail", async () => {
    const { headers } = await criarUsuarioAutenticado(app, { email: "valido@example.com" });
    const casos = [
      [{ nome: "A".repeat(121), email: "valido@example.com" }, "nome"],
      [{ nome: "Fulano", email: "abc" }, "email"],
      [{ nome: "Fulano", email: `${"a".repeat(160)}@example.com` }, "email"],
      [{ nome: "Fulano", email: "com espaco@example.com" }, "email"],
    ];
    for (const [corpo, campo] of casos) {
      const res = await request(app).put("/api/users/me").set(headers).send(corpo);
      expect([campo, res.status]).toEqual([campo, 422]);
      expect(res.body.campos[campo]).toBeDefined();
    }
  });

  test("PUT /users/me continua aceitando dados validos (nome de 120 caracteres inclusive)", async () => {
    const { headers } = await criarUsuarioAutenticado(app, { email: "valido2@example.com" });
    const res = await request(app).put("/api/users/me").set(headers).send({ nome: "B".repeat(120), email: "novo.email@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe("novo.email@example.com");
  });

  test("e-mail com marcacao HTML e' recusado no cadastro e no perfil (XSS armazenado)", async () => {
    const perigosos = ["<img/src=x/onerror=alert(1)>@a.co", "a<script>@b.co", 'x"y@b.co', "x'y@b.co"];
    for (const email of perigosos) {
      const cadastro = await request(app).post("/api/auth/register")
        .send({ nome: "Fulano", email, senha: "senhaForte123", confirmarSenha: "senhaForte123" });
      expect([email, cadastro.status]).toEqual([email, 422]);
      expect(cadastro.body.campos.email).toBeDefined();
    }
    const { headers } = await criarUsuarioAutenticado(app);
    const perfil = await request(app).put("/api/users/me").set(headers).send({ nome: "Fulano", email: perigosos[0] });
    expect(perfil.status).toBe(422);
  });
});

describe("rotas /receitas e /despesas so' mexem no proprio tipo (antes: converte/apaga o outro tipo)", () => {
  async function criarDespesa(headers) {
    const res = await request(app).post("/api/despesas").set(headers).send({ descricao: "Aluguel", valor: 900, data: "2026-03-05" });
    return res.body.movimentacao.id;
  }

  test("PUT e DELETE em /receitas/:id de uma despesa retornam 404 e nao alteram nada", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const id = await criarDespesa(headers);

    const put = await request(app).put(`/api/receitas/${id}`).set(headers).send({ descricao: "Virou receita", valor: 900, data: "2026-03-05" });
    expect(put.status).toBe(404);
    const del = await request(app).delete(`/api/receitas/${id}`).set(headers);
    expect(del.status).toBe(404);

    const lista = await request(app).get("/api/despesas").set(headers);
    expect(lista.body.movimentacoes).toHaveLength(1);
    expect(lista.body.movimentacoes[0]).toMatchObject({ id, tipo: "despesa", descricao: "Aluguel" });
  });

  test("a rota do proprio tipo e a rota geral continuam funcionando", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const id = await criarDespesa(headers);

    const put = await request(app).put(`/api/despesas/${id}`).set(headers).send({ descricao: "Aluguel novo", valor: 950, data: "2026-03-05" });
    expect(put.status).toBe(200);
    expect(put.body.movimentacao.tipo).toBe("despesa");

    const geral = await request(app).put(`/api/movimentacoes/${id}`).set(headers)
      .send({ tipo: "despesa", descricao: "Pela rota geral", valor: 951, data: "2026-03-05" });
    expect(geral.status).toBe(200);

    expect((await request(app).delete(`/api/despesas/${id}`).set(headers)).status).toBe(204);
  });
});
