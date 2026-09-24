"use strict";

// Recorrencias: preenche meses em que a pessoa nao abriu o app, sem ressuscitar o que foi apagado
// de proposito e sem "recuperar" o periodo em que a recorrencia ficou pausada.

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const recorrenciaService = require("../src/services/recorrencia.service");
const { criarUsuarioAutenticado } = require("./helpers");

const app = createApp();

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE orcamentos, recorrencias, metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});
afterAll(async () => pool.end());

const AGORA = new Date("2026-08-20T15:00:00Z"); // 20/08/2026 em Brasilia

async function novaRecorrencia(diaMes, extra = {}) {
  const { headers, usuarioId } = await criarUsuarioAutenticado(app);
  const res = await request(app).post("/api/recorrencias").set(headers)
    .send({ tipo: "despesa", descricao: "Aluguel", valor: 1000, diaMes, ...extra });
  expect(res.status).toBe(201);
  return { headers, usuarioId, id: res.body.recorrencia.id };
}

const datas = async (usuarioId) =>
  (await pool.query("SELECT to_char(data, 'YYYY-MM-DD') AS d FROM movimentacoes WHERE usuario_id = $1 ORDER BY data", [usuarioId]))
    .rows.map((r) => r.d);

describe("preenchimento de meses atrasados", () => {
  test("recorrencia criada em maio e nunca processada gera maio, junho, julho e agosto", async () => {
    const { usuarioId, id } = await novaRecorrencia(5);
    await pool.query("UPDATE recorrencias SET criado_em = '2026-05-10T12:00:00Z' WHERE id = $1", [id]);

    const geradas = await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA);
    expect(geradas).toHaveLength(4);
    expect(await datas(usuarioId)).toEqual(["2026-05-05", "2026-06-05", "2026-07-05", "2026-08-05"]);
  });

  test("so' preenche os meses DEPOIS do ultimo processado", async () => {
    const { usuarioId, id } = await novaRecorrencia(5);
    await pool.query("UPDATE recorrencias SET criado_em = '2026-01-10T12:00:00Z', ultimo_mes_gerado = '2026-06-01' WHERE id = $1", [id]);

    await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA);
    expect(await datas(usuarioId)).toEqual(["2026-07-05", "2026-08-05"]); // nada de janeiro a maio
  });

  test("limita o preenchimento a 12 meses", async () => {
    const { usuarioId, id } = await novaRecorrencia(5);
    await pool.query("UPDATE recorrencias SET criado_em = '2024-01-10T12:00:00Z' WHERE id = $1", [id]);

    await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA);
    const lista = await datas(usuarioId);
    expect(lista).toHaveLength(12);
    expect(lista[0]).toBe("2025-09-05");
    expect(lista[11]).toBe("2026-08-05");
  });

  test("no mes atual so' gera se o dia ja chegou (dia 28 em 20/08 gera ate' julho)", async () => {
    const { usuarioId, id } = await novaRecorrencia(28);
    await pool.query("UPDATE recorrencias SET criado_em = '2026-06-10T12:00:00Z' WHERE id = $1", [id]);

    await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA);
    expect(await datas(usuarioId)).toEqual(["2026-06-28", "2026-07-28"]);
    // quando o dia chegar, gera o de agosto (sem repetir os anteriores)
    await recorrenciaService.gerarDoMesAtual(usuarioId, new Date("2026-08-28T15:00:00Z"));
    expect(await datas(usuarioId)).toEqual(["2026-06-28", "2026-07-28", "2026-08-28"]);
  });
});

describe("nao ressuscita o que a pessoa apagou", () => {
  test("lancamento apagado do mes atual NAO volta na proxima abertura", async () => {
    const { usuarioId, id } = await novaRecorrencia(5);
    await pool.query("UPDATE recorrencias SET criado_em = '2026-08-01T12:00:00Z' WHERE id = $1", [id]);
    await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA);
    expect(await datas(usuarioId)).toEqual(["2026-08-05"]);

    await pool.query("DELETE FROM movimentacoes WHERE usuario_id = $1", [usuarioId]);
    await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA);
    expect(await datas(usuarioId)).toEqual([]);
  });

  test("lancamento apagado de um mes passado NAO volta quando meses novos sao preenchidos", async () => {
    const { usuarioId, id } = await novaRecorrencia(5);
    await pool.query("UPDATE recorrencias SET criado_em = '2026-05-10T12:00:00Z' WHERE id = $1", [id]);
    await recorrenciaService.gerarDoMesAtual(usuarioId, new Date("2026-07-20T15:00:00Z")); // mai, jun, jul
    await pool.query("DELETE FROM movimentacoes WHERE usuario_id = $1 AND data = '2026-06-05'", [usuarioId]);

    await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA); // agosto
    expect(await datas(usuarioId)).toEqual(["2026-05-05", "2026-07-05", "2026-08-05"]);
  });
});

describe("recorrencia pausada", () => {
  test("nao gera enquanto pausada e, ao reativar, nao recupera o periodo parado", async () => {
    const { headers, usuarioId, id } = await novaRecorrencia(5);
    await pool.query("UPDATE recorrencias SET criado_em = '2026-01-10T12:00:00Z', ultimo_mes_gerado = '2026-01-01' WHERE id = $1", [id]);

    const editar = (ativa) => request(app).put(`/api/recorrencias/${id}`).set(headers)
      .send({ tipo: "despesa", descricao: "Aluguel", valor: 1000, diaMes: 5, ativa });

    expect((await editar(false)).status).toBe(200);
    await recorrenciaService.gerarDoMesAtual(usuarioId, AGORA);
    expect(await datas(usuarioId)).toEqual([]); // pausada: nada

    expect((await editar(true)).status).toBe(200); // reativa
    const { rows } = await pool.query(
      `SELECT ultimo_mes_gerado = (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month')::date AS ok
         FROM recorrencias WHERE id = $1`, [id]
    );
    expect(rows[0].ok).toBe(true); // volta a gerar so' a partir do mes atual
  });

  test("editar sem mudar o estado (ja ativa) nao mexe no ultimo mes processado", async () => {
    const { headers, id } = await novaRecorrencia(5);
    await pool.query("UPDATE recorrencias SET ultimo_mes_gerado = '2026-03-01' WHERE id = $1", [id]);
    await request(app).put(`/api/recorrencias/${id}`).set(headers)
      .send({ tipo: "despesa", descricao: "Aluguel novo", valor: 1200, diaMes: 6, ativa: true });
    const { rows } = await pool.query("SELECT to_char(ultimo_mes_gerado, 'YYYY-MM-DD') AS d FROM recorrencias WHERE id = $1", [id]);
    expect(rows[0].d).toBe("2026-03-01");
  });
});
