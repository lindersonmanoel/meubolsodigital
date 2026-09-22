"use strict";

const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");

const app = createApp();

const usuarioValido = {
  nome: "Set Hudson",
  email: "set.teste@example.com",
  senha: "senhaForte123",
  confirmarSenha: "senhaForte123",
};

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

describe("POST /api/auth/register", () => {
  test("cria uma conta valida e nao devolve a senha", async () => {
    const res = await request(app).post("/api/auth/register").send(usuarioValido);
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ nome: usuarioValido.nome, email: usuarioValido.email });
    expect(res.body.usuario.senha_hash).toBeUndefined();
    expect(res.body.usuario.senha).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(usuarioValido.senha);
  });

  test("recusa e-mail duplicado", async () => {
    await request(app).post("/api/auth/register").send(usuarioValido);
    const res = await request(app).post("/api/auth/register").send(usuarioValido);
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/j[aá] existe/i);
  });

  test("e-mail duplicado ignora maiusculas/minusculas e espacos", async () => {
    await request(app).post("/api/auth/register").send(usuarioValido);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...usuarioValido, email: `  ${usuarioValido.email.toUpperCase()}  ` });
    expect(res.status).toBe(409);
  });

  test.each([
    ["nome vazio", { ...usuarioValido, nome: "" }, "nome"],
    ["e-mail invalido", { ...usuarioValido, email: "nao-e-email" }, "email"],
    ["senha curta", { ...usuarioValido, senha: "123", confirmarSenha: "123" }, "senha"],
    ["senhas diferentes", { ...usuarioValido, confirmarSenha: "outra-senha" }, "confirmarSenha"],
  ])("rejeita: %s", async (_label, payload, campo) => {
    const res = await request(app).post("/api/auth/register").send(payload);
    expect(res.status).toBe(422);
    expect(res.body.campos).toHaveProperty(campo);
  });

  test("a senha fica salva com hash, nunca em texto puro", async () => {
    await request(app).post("/api/auth/register").send(usuarioValido);
    const { rows } = await pool.query("SELECT senha_hash FROM usuarios WHERE email = $1", [usuarioValido.email]);
    expect(rows[0].senha_hash).not.toBe(usuarioValido.senha);
    expect(rows[0].senha_hash).toMatch(/^\$2[aby]\$/); // formato do hash bcrypt
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(usuarioValido);
  });

  test("autentica com credenciais corretas e devolve um token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: usuarioValido.email, senha: usuarioValido.senha });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario.email).toBe(usuarioValido.email);
  });

  test("recusa senha errada com mensagem generica", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: usuarioValido.email, senha: "senha-errada" });
    expect(res.status).toBe(401);
    expect(res.body.erro).toMatch(/inv[aá]lid/i);
  });

  test("recusa e-mail inexistente com a MESMA mensagem generica (nao revela quais e-mails existem)", async () => {
    const resSenhaErrada = await request(app)
      .post("/api/auth/login")
      .send({ email: usuarioValido.email, senha: "senha-errada" });
    const resEmailInexistente = await request(app)
      .post("/api/auth/login")
      .send({ email: "ninguem@example.com", senha: "qualquer-coisa" });
    expect(resEmailInexistente.status).toBe(401);
    expect(resEmailInexistente.body.erro).toBe(resSenhaErrada.body.erro);
  });
});

describe("GET /api/auth/me", () => {
  async function registrarELogar() {
    await request(app).post("/api/auth/register").send(usuarioValido);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: usuarioValido.email, senha: usuarioValido.senha });
    return login.body.token;
  }

  test("sem token: 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("com token invalido: 401", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer token-invalido-qualquer");
    expect(res.status).toBe(401);
  });

  test("com token valido: devolve o proprio usuario", async () => {
    const token = await registrarELogar();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe(usuarioValido.email);
  });
});

describe("PUT /api/users/me", () => {
  async function registrarELogar() {
    await request(app).post("/api/auth/register").send(usuarioValido);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: usuarioValido.email, senha: usuarioValido.senha });
    return login.body.token;
  }

  test("atualiza nome e e-mail do proprio usuario", async () => {
    const token = await registrarELogar();
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Set Hudson Costa", email: "novo@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ nome: "Set Hudson Costa", email: "novo@example.com" });
  });

  test("nao deixa trocar para um e-mail ja usado por outra conta", async () => {
    const token = await registrarELogar();
    await request(app)
      .post("/api/auth/register")
      .send({ ...usuarioValido, email: "outra@example.com" });
    const res = await request(app)
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: usuarioValido.nome, email: "outra@example.com" });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/users/senha", () => {
  async function registrarELogar() {
    await request(app).post("/api/auth/register").send(usuarioValido);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: usuarioValido.email, senha: usuarioValido.senha });
    return login.body.token;
  }

  test("troca a senha e permite logar com a nova (e não mais com a antiga)", async () => {
    const token = await registrarELogar();
    const res = await request(app)
      .put("/api/users/senha")
      .set("Authorization", `Bearer ${token}`)
      .send({ senhaAtual: usuarioValido.senha, novaSenha: "novaSenha456", confirmarNovaSenha: "novaSenha456" });
    expect(res.status).toBe(200);

    const loginAntiga = await request(app).post("/api/auth/login").send({ email: usuarioValido.email, senha: usuarioValido.senha });
    expect(loginAntiga.status).toBe(401);

    const loginNova = await request(app).post("/api/auth/login").send({ email: usuarioValido.email, senha: "novaSenha456" });
    expect(loginNova.status).toBe(200);
  });

  test("recusa se a senha atual estiver errada", async () => {
    const token = await registrarELogar();
    const res = await request(app)
      .put("/api/users/senha")
      .set("Authorization", `Bearer ${token}`)
      .send({ senhaAtual: "senha-errada", novaSenha: "novaSenha456", confirmarNovaSenha: "novaSenha456" });
    expect(res.status).toBe(401);
  });

  test("recusa se as novas senhas não coincidirem ou forem curtas", async () => {
    const token = await registrarELogar();
    const diferentes = await request(app)
      .put("/api/users/senha")
      .set("Authorization", `Bearer ${token}`)
      .send({ senhaAtual: usuarioValido.senha, novaSenha: "novaSenha456", confirmarNovaSenha: "outra" });
    expect(diferentes.status).toBe(422);

    const curta = await request(app)
      .put("/api/users/senha")
      .set("Authorization", `Bearer ${token}`)
      .send({ senhaAtual: usuarioValido.senha, novaSenha: "curta", confirmarNovaSenha: "curta" });
    expect(curta.status).toBe(422);
  });

  test("exige autenticação", async () => {
    const res = await request(app).put("/api/users/senha").send({});
    expect(res.status).toBe(401);
  });
});

describe("saude e rotas desconhecidas", () => {
  test("GET /api/health responde ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("rota inexistente devolve 404 em JSON", async () => {
    const res = await request(app).get("/api/isso-nao-existe");
    expect(res.status).toBe(404);
    expect(res.body.erro).toBeDefined();
  });

  test("token valido mas de usuario que nao existe mais: 404, nao 500", async () => {
    const jwt = require("jsonwebtoken");
    const config = require("../src/config");
    const tokenOrfao = jwt.sign({ sub: "999999" }, config.jwtSecret, { expiresIn: "1h" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tokenOrfao}`);
    expect(res.status).toBe(404);
  });

  test("JSON malformado no corpo devolve 400 com mensagem, nao 500", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{ isso nao e json valido");
    expect(res.status).toBe(400);
    expect(res.body.erro).toBeDefined();
  });
});
