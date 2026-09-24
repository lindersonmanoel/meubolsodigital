"use strict";

// Testes das correcoes da auditoria (etapa 2): sessoes invalidadas ao trocar a senha, login com
// tempo uniforme, health check com banco, limites de requisicao, fuso horario, recorrencias sem
// duplicar, encerramento gracioso e varias origens no CORS.

const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const createApp = require("../src/app");
const config = require("../src/config");
const pool = require("../src/database/pool");
const emailService = require("../src/services/email.service");
const recorrenciaService = require("../src/services/recorrencia.service");
const { criarLimiter } = require("../src/middleware/limiters");
const { partesNoFuso, anoMesAtual, inicioDoMesAtual } = require("../src/utils/fuso");
const { criarUsuarioAutenticado } = require("./helpers");

const app = createApp();

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => pool.end());

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe("sessoes invalidadas ao trocar/redefinir a senha (SEG-01)", () => {
  test("trocar a senha derruba o token antigo e devolve um token novo que funciona", async () => {
    const { headers } = await criarUsuarioAutenticado(app, { senha: "senhaForte123" });
    expect((await request(app).get("/api/auth/me").set(headers)).status).toBe(200);

    const troca = await request(app).put("/api/users/senha").set(headers)
      .send({ senhaAtual: "senhaForte123", novaSenha: "outraSenha456", confirmarNovaSenha: "outraSenha456" });
    expect(troca.status).toBe(200);
    expect(typeof troca.body.token).toBe("string");

    expect((await request(app).get("/api/auth/me").set(headers)).status).toBe(401); // token antigo
    expect((await request(app).get("/api/auth/me").set(bearer(troca.body.token))).status).toBe(200); // token novo
  });

  test("senha atual errada continua 401 e NAO invalida a sessao", async () => {
    const { headers } = await criarUsuarioAutenticado(app, { senha: "senhaForte123" });
    const res = await request(app).put("/api/users/senha").set(headers)
      .send({ senhaAtual: "errada-errada", novaSenha: "outraSenha456", confirmarNovaSenha: "outraSenha456" });
    expect(res.status).toBe(401);
    expect((await request(app).get("/api/auth/me").set(headers)).status).toBe(200);
  });

  test("redefinir a senha por 'esqueci minha senha' tambem derruba as sessoes existentes", async () => {
    const { headers } = await criarUsuarioAutenticado(app, { email: "esqueci@example.com", senha: "senhaForte123" });
    const spy = jest.spyOn(emailService, "enviarRecuperacaoSenha").mockResolvedValue();
    await request(app).post("/api/auth/esqueci-senha").send({ email: "esqueci@example.com" });
    const token = new URL(spy.mock.calls[0][0].link).searchParams.get("token");

    const red = await request(app).post("/api/auth/redefinir-senha")
      .send({ token, novaSenha: "senhaNova789", confirmarNovaSenha: "senhaNova789" });
    expect(red.status).toBe(200);

    expect((await request(app).get("/api/auth/me").set(headers)).status).toBe(401);
    const login = await request(app).post("/api/auth/login").send({ email: "esqueci@example.com", senha: "senhaNova789" });
    expect(login.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set(bearer(login.body.token))).status).toBe(200);
  });

  test("token emitido antes da mudanca (sem 'tv') continua valido ate a proxima troca de senha", async () => {
    const { usuarioId } = await criarUsuarioAutenticado(app);
    const antigo = jwt.sign({ sub: String(usuarioId) }, config.jwtSecret, { algorithm: "HS256", expiresIn: "1h" });
    expect((await request(app).get("/api/auth/me").set(bearer(antigo))).status).toBe(200);
  });

  test("recusa token de outro algoritmo (HS512) e de usuario que nao existe", async () => {
    const { usuarioId } = await criarUsuarioAutenticado(app);
    const hs512 = jwt.sign({ sub: String(usuarioId), tv: 0 }, config.jwtSecret, { algorithm: "HS512" });
    expect((await request(app).get("/api/auth/me").set(bearer(hs512))).status).toBe(401);
    const fantasma = jwt.sign({ sub: "999999", tv: 0 }, config.jwtSecret, { algorithm: "HS256" });
    expect((await request(app).get("/api/auth/me").set(bearer(fantasma))).status).toBe(401);
  });
});

describe("login com tempo uniforme e e-mail sem esperar (SEG-03)", () => {
  test("roda o bcrypt tambem quando o e-mail nao existe", async () => {
    const compare = jest.spyOn(bcrypt, "compare");
    const res = await request(app).post("/api/auth/login").send({ email: "ninguem@example.com", senha: "qualquerSenha1" });
    expect(res.status).toBe(401);
    expect(res.body.erro).toBe("E-mail ou senha inválidos.");
    expect(compare).toHaveBeenCalledTimes(1);
  });

  test("esqueci-senha responde sem esperar o envio do e-mail terminar", async () => {
    await criarUsuarioAutenticado(app, { email: "rapido@example.com" });
    let liberar;
    const envio = new Promise((resolve) => { liberar = resolve; });
    let terminou = false;
    jest.spyOn(emailService, "enviarRecuperacaoSenha").mockImplementation(() => envio.then(() => { terminou = true; }));

    const res = await request(app).post("/api/auth/esqueci-senha").send({ email: "rapido@example.com" });
    expect(res.status).toBe(200);
    expect(terminou).toBe(false); // a resposta saiu com o e-mail ainda "pendente"
    liberar();
    await envio;
  });

  test("falha inesperada no envio nao derruba a resposta", async () => {
    await criarUsuarioAutenticado(app, { email: "falha@example.com" });
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(emailService, "enviarRecuperacaoSenha").mockRejectedValue(new Error("Resend fora do ar"));
    const res = await request(app).post("/api/auth/esqueci-senha").send({ email: "falha@example.com" });
    expect(res.status).toBe(200);
  });
});

describe("health check com banco (INF-02)", () => {
  test("/api/health continua simples e /api/health/ready confirma o banco", async () => {
    expect((await request(app).get("/api/health")).body.status).toBe("ok");
    const ready = await request(app).get("/api/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.body).toMatchObject({ status: "ok", banco: "ok" });
    expect(typeof ready.body.email).toBe("string"); // estado do e-mail (sem segredos)
  });

  test("/api/health/ready responde 503 quando o banco falha", async () => {
    jest.spyOn(pool, "query").mockRejectedValueOnce(new Error("banco fora"));
    const ready = await request(app).get("/api/health/ready");
    expect(ready.status).toBe(503);
    expect(ready.body.banco).toBe("falha");
  });
});

describe("limite de requisicoes (SEG-05)", () => {
  test("o limitador reutilizavel bloqueia com 429 depois do limite (fabrica em modo teste tem teto alto)", async () => {
    // Em teste o teto sobe (config.isTest); aqui monta um limitador baixo direto do express-rate-limit
    // via a mesma fabrica, trocando temporariamente a flag de teste.
    const antigo = config.isTest;
    config.isTest = false;
    const limiter = criarLimiter({ limit: 2, mensagem: "Muitas requisições. Aguarde." });
    config.isTest = antigo;

    const pequeno = express();
    pequeno.get("/x", limiter, (_req, res) => res.json({ ok: true }));
    const status = [];
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      status.push((await request(pequeno).get("/x")).status);
    }
    expect(status).toEqual([200, 200, 429]);
  });

  test("rotas de exportacao e backup continuam funcionando (limite alto em teste)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    expect((await request(app).get("/api/movimentacoes/exportar").set(headers)).status).toBe(200);
    expect((await request(app).get("/api/backup").set(headers)).status).toBe(200);
  });
});

describe("fuso horario unico: America/Sao_Paulo (BUG-07)", () => {
  test("partesNoFuso: 23h30 de 30/09 em Brasilia ainda e' setembro, mesmo sendo 02h30 UTC de 01/10", () => {
    expect(partesNoFuso(new Date("2026-10-01T02:30:00Z"))).toEqual({ ano: 2026, mes: 9, dia: 30 });
    expect(anoMesAtual(new Date("2026-10-01T02:30:00Z"))).toBe("2026-09");
    expect(inicioDoMesAtual(new Date("2026-10-01T02:30:00Z"))).toBe("2026-09-01");
  });

  test("partesNoFuso: 00h30 de 01/10 em Brasilia (03h30 UTC) ja e' outubro; virada de ano tambem", () => {
    expect(partesNoFuso(new Date("2026-10-01T03:30:00Z"))).toEqual({ ano: 2026, mes: 10, dia: 1 });
    expect(partesNoFuso(new Date("2027-01-01T02:59:00Z"))).toEqual({ ano: 2026, mes: 12, dia: 31 });
    expect(partesNoFuso(new Date("2027-01-01T03:00:00Z"))).toEqual({ ano: 2027, mes: 1, dia: 1 });
  });

  // Fixa criado_em/ultimo_mes_gerado pra o teste nao depender da data real de hoje.
  async function novaRecorrenciaDia1(criadoEm, ultimoMes = null) {
    const { headers, usuarioId } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/recorrencias").set(headers)
      .send({ tipo: "despesa", descricao: "Aluguel", valor: 1000, diaMes: 1 });
    expect(res.status).toBe(201);
    await pool.query("UPDATE recorrencias SET criado_em = $1, ultimo_mes_gerado = $2 WHERE id = $3",
      [criadoEm, ultimoMes, res.body.recorrencia.id]);
    return usuarioId;
  }
  const geradas = async (usuarioId) =>
    (await pool.query("SELECT to_char(data, 'YYYY-MM-DD') AS data FROM movimentacoes WHERE usuario_id = $1 ORDER BY data", [usuarioId])).rows.map((r) => r.data);

  test("as 23h30 do ultimo dia do mes (Brasilia) NAO lanca a recorrencia do dia 1 do mes seguinte", async () => {
    const usuarioId = await novaRecorrenciaDia1("2026-09-15T12:00:00Z");
    // 02h30 UTC de 01/10 = 23h30 de 30/09 em Brasilia: ainda e' setembro, entao o lancamento
    // e' o de 01/09 (o codigo antigo, em UTC, achava que ja era outubro e gerava 01/10 cedo demais).
    await recorrenciaService.gerarDoMesAtual(usuarioId, new Date("2026-10-01T02:30:00Z"));
    expect(await geradas(usuarioId)).toEqual(["2026-09-01"]);
  });

  test("depois da meia-noite em Brasilia o lancamento e' de outubro", async () => {
    const usuarioId = await novaRecorrenciaDia1("2026-09-15T12:00:00Z", "2026-09-01"); // setembro ja processado
    await recorrenciaService.gerarDoMesAtual(usuarioId, new Date("2026-10-01T03:30:00Z"));
    expect(await geradas(usuarioId)).toEqual(["2026-10-01"]);
  });
});

describe("recorrencia gera uma unica movimentacao por mes, mesmo com chamadas simultaneas (BUG-08)", () => {
  test("o indice unico existe", async () => {
    const { rows } = await pool.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_mov_recorrencia_mes'");
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/UNIQUE/i);
  });

  test("15 geracoes simultaneas produzem exatamente 1 lancamento", async () => {
    const { headers, usuarioId } = await criarUsuarioAutenticado(app);
    const rec = await request(app).post("/api/recorrencias").set(headers).send({ tipo: "despesa", descricao: "Internet", valor: 100, diaMes: 1 });
    await pool.query("UPDATE recorrencias SET criado_em = '2026-08-01T12:00:00Z' WHERE id = $1", [rec.body.recorrencia.id]);
    const agora = new Date("2026-08-20T15:00:00Z");
    await Promise.all(Array.from({ length: 15 }, () => recorrenciaService.gerarDoMesAtual(usuarioId, agora)));
    const { rows } = await pool.query("SELECT count(*)::int AS total FROM movimentacoes WHERE usuario_id = $1", [usuarioId]);
    expect(rows[0].total).toBe(1);
  });

  test("o banco recusa uma segunda movimentacao da mesma recorrencia no mesmo mes", async () => {
    const { headers, usuarioId } = await criarUsuarioAutenticado(app);
    const rec = await request(app).post("/api/recorrencias").set(headers).send({ tipo: "despesa", descricao: "Gas", valor: 50, diaMes: 5 });
    const id = rec.body.recorrencia.id;
    const inserir = (dia) => pool.query(
      "INSERT INTO movimentacoes (usuario_id, tipo, descricao, valor, data, recorrencia_id) VALUES ($1, 'despesa', 'Gas', 50, $2, $3)",
      [usuarioId, dia, id]
    );
    await inserir("2026-08-05");
    await expect(inserir("2026-08-20")).rejects.toMatchObject({ code: "23505" });
    await inserir("2026-09-05"); // outro mes pode
  });
});

describe("CORS com mais de uma origem em FRONTEND_URL (migracao de dominio)", () => {
  let appProducao;
  const chaves = ["NODE_ENV", "FRONTEND_URL"];
  const salvas = {};

  beforeAll(() => {
    chaves.forEach((k) => { salvas[k] = process.env[k]; });
    jest.resetModules();
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://novo.exemplo.com.br/, https://antigo.vercel.app";
    appProducao = require("../src/app")();
    chaves.forEach((k) => {
      if (salvas[k] === undefined) delete process.env[k];
      else process.env[k] = salvas[k];
    });
  });
  afterAll(() => jest.resetModules());

  test.each(["https://novo.exemplo.com.br", "https://antigo.vercel.app"])("libera %s", async (origem) => {
    const res = await request(appProducao).get("/api/health").set("Origin", origem);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(origem);
  });

  test("bloqueia qualquer outra origem", async () => {
    const res = await request(appProducao).get("/api/health").set("Origin", "https://intruso.com");
    expect(res.status).toBe(403);
  });
});

describe("encerramento gracioso (INF-01)", () => {
  const teste = process.platform === "win32" ? test.skip : test;

  teste("SIGTERM fecha o servidor e sai com codigo 0 em poucos segundos", async () => {
    const porta = String(4300 + Math.floor(Math.random() * 500));
    const filho = spawn(process.execPath, [path.join(__dirname, "..", "src", "server.js")], {
      env: { ...process.env, PORT: porta },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let saida = "";
    filho.stdout.on("data", (d) => { saida += d; });
    filho.stderr.on("data", (d) => { saida += d; });

    try {
      // sobe (com folga: maquina/CI carregado pode demorar)
      await new Promise((resolve, rejeita) => {
        const olhar = setInterval(() => {
          if (saida.includes("rodando na porta")) { clearTimeout(limite); clearInterval(olhar); resolve(); }
        }, 50);
        const limite = setTimeout(() => { clearInterval(olhar); rejeita(new Error(`servidor nao subiu: ${saida}`)); }, 25000);
      });

      const codigo = await new Promise((resolve) => {
        filho.on("exit", (c) => resolve(c));
        filho.kill("SIGTERM");
      });
      expect(codigo).toBe(0);
      expect(saida).toMatch(/SIGTERM recebido/);
    } finally {
      // nunca deixa o servidor de teste vivo (senao o Jest nao encerra)
      if (filho.exitCode === null && filho.signalCode === null) filho.kill("SIGKILL");
    }
  }, 60000);
});
