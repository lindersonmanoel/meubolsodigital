"use strict";

const request = require("supertest");
const createApp = require("../src/app");

const app = createApp();

describe("CORS em desenvolvimento/teste", () => {
  test.each(["http://localhost:5500", "http://127.0.0.1:5500", "http://127.0.0.1:9999"])(
    "libera qualquer porta em localhost/127.0.0.1: %s",
    async (origin) => {
      const res = await request(app).get("/api/health").set("Origin", origin);
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(origin);
    }
  );

  test("bloqueia origem que nao e localhost", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://site-qualquer.com");
    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("requisicao sem cabecalho Origin (curl, apps) continua funcionando", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});

describe("CORS em producao", () => {
  // Producao e mais estrita: so o FRONTEND_URL exato passa, nem "localhost" vira excecao.
  let appProducao;

  beforeAll(() => {
    jest.resetModules();
    const antigo = { ...process.env };
    Object.assign(process.env, {
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_URL: "https://meubolsodigital.com.br",
    });
    appProducao = require("../src/app")();
    process.env = antigo;
  });

  afterAll(() => {
    jest.resetModules();
  });

  test("libera exatamente o FRONTEND_URL configurado", async () => {
    const res = await request(appProducao).get("/api/health").set("Origin", "https://meubolsodigital.com.br");
    expect(res.status).toBe(200);
  });

  test("bloqueia localhost em producao (nao e mais excecao)", async () => {
    const res = await request(appProducao).get("/api/health").set("Origin", "http://localhost:5500");
    expect(res.status).toBe(403);
  });
});
