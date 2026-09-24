"use strict";

// Itens medios da auditoria: restauracao de backup robusta (transacao, lote, vinculo com recorrencias, limite
// de corpo), excluir categoria em uso, CSV com virgula, trava de migracao, pool e indices.

const path = require("path");
const { spawn } = require("child_process");
const request = require("supertest");
const createApp = require("../src/app");
const pool = require("../src/database/pool");
const senha = require("../src/utils/senha");
const { partesNoFuso } = require("../src/utils/fuso");
const { criarUsuarioAutenticado } = require("./helpers");

const app = createApp();

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE orcamentos, recorrencias, metas, movimentacoes, categorias, usuarios RESTART IDENTITY CASCADE");
});
afterAll(async () => pool.end());

const backupBase = (extra = {}) => ({ versao: 1, categorias: [], movimentacoes: [], metas: [], orcamentos: [], recorrencias: [], ...extra });
const mov = (i, extra = {}) => ({ tipo: "despesa", descricao: `Item de teste numero ${i}`, valor: 10 + (i % 90), data: "2026-01-15", observacao: "obs de teste", ...extra });

describe("restauracao de backup robusta (BUG-06)", () => {
  test("aceita backup GRANDE (>1 MB) e insere tudo em lote, rapido", async () => {
    const { headers, usuarioId } = await criarUsuarioAutenticado(app);
    const itens = Array.from({ length: 9500 }, (_, i) => mov(i));
    const corpo = backupBase({ movimentacoes: itens });
    expect(JSON.stringify(corpo).length).toBeGreaterThan(1024 * 1024); // acima do limite antigo de 1 MB

    const inicio = Date.now();
    const res = await request(app).post("/api/backup/restaurar").set(headers).send(corpo);
    expect(res.status).toBe(200);
    expect(res.body.resultado.movimentacoes).toBe(9500);
    expect(Date.now() - inicio).toBeLessThan(20000);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM movimentacoes WHERE usuario_id = $1", [usuarioId]);
    expect(rows[0].n).toBe(9500);
  }, 60000);

  test("as outras rotas continuam limitadas a 1 MB", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const enorme = { nome: "x", tipo: "despesa", lixo: "a".repeat(1.5 * 1024 * 1024) };
    const res = await request(app).post("/api/categorias").set(headers).send(enorme);
    expect(res.status).toBe(413);
  });

  test("sem login a restauracao responde 401 (sem ler o corpo grande)", async () => {
    const res = await request(app).post("/api/backup/restaurar").send(backupBase({ movimentacoes: [mov(1)] }));
    expect(res.status).toBe(401);
  });

  test("itens invalidos sao pulados com aviso e os validos entram (nada quebra)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/backup/restaurar").set(headers).send(backupBase({
      categorias: [{ nome: "Mercado", tipo: "despesa" }, { nome: "x", tipo: "invalido" }],
      movimentacoes: [mov(1, { categoriaNome: "Mercado" }), mov(2, { data: "2026-02-31" }), mov(3, { valor: -5 }), mov(4, { tipo: "xx" }), mov(5, { valor: 1e12 })],
      metas: [{ nome: "Viagem", valorObjetivo: 1000, prazo: "2026-04-31" }, { nome: "Reserva", valorObjetivo: 500, valorAtual: 100 }],
      orcamentos: [{ categoriaNome: "Inexistente", valorLimite: 100 }, { categoriaNome: "Mercado", valorLimite: 300 }],
      recorrencias: [{ tipo: "despesa", descricao: "Aluguel", valor: 1000, diaMes: 31 }, { tipo: "despesa", descricao: "Internet", valor: 100, diaMes: 10 }],
    }));
    expect(res.status).toBe(200);
    expect(res.body.resultado).toMatchObject({ categorias: 1, movimentacoes: 1, metas: 1, orcamentos: 1, recorrencias: 1 });
    expect(res.body.resultado.avisos.length).toBeGreaterThanOrEqual(7);
  });

  test("avisos sao limitados (backup muito sujo nao gera resposta gigante)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const sujo = Array.from({ length: 300 }, (_, i) => mov(i, { data: "nao-e-data" }));
    const res = await request(app).post("/api/backup/restaurar").set(headers).send(backupBase({ movimentacoes: sujo }));
    expect(res.status).toBe(200);
    expect(res.body.resultado.movimentacoes).toBe(0);
    expect(res.body.resultado.avisos.length).toBeLessThanOrEqual(51);
    expect(res.body.resultado.avisos.at(-1)).toMatch(/e mais 250 aviso/);
  });

  test("falha no meio desfaz TUDO (transacao): nada fica pela metade", async () => {
    const { headers, usuarioId } = await criarUsuarioAutenticado(app);
    // derruba o INSERT das metas (depois de categorias, recorrencias e movimentacoes ja inseridas na transacao).
    // ATENCAO: o pg-pool chama pool.connect(callback) por dentro do pool.query; so' o estilo "promessa" (sem
    // argumentos), usado pelo servico de backup, e' interceptado - o resto segue direto pro original.
    const original = pool.connect.bind(pool);
    const espiao = jest.spyOn(pool, "connect").mockImplementation((cb) => {
      if (typeof cb === "function") return original(cb);
      return original().then((client) => {
        const query = client.query.bind(client);
        client.query = (sql, ...resto) => {
          if (typeof sql === "string" && sql.includes("INSERT INTO metas")) return Promise.reject(new Error("falha simulada"));
          return query(sql, ...resto);
        };
        return client;
      });
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
    let res;
    try {
      res = await request(app).post("/api/backup/restaurar").set(headers).send(backupBase({
        categorias: [{ nome: "Mercado", tipo: "despesa" }],
        movimentacoes: [mov(1, { categoriaNome: "Mercado" }), mov(2)],
        metas: [{ nome: "Reserva", valorObjetivo: 500 }],
        recorrencias: [{ tipo: "despesa", descricao: "Internet", valor: 100, diaMes: 10 }],
      }));
    } finally {
      espiao.mockRestore();
      jest.restoreAllMocks();
    }
    expect(res.status).toBe(500);
    for (const tabela of ["categorias", "movimentacoes", "recorrencias", "metas"]) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${tabela} WHERE usuario_id = $1`, [usuarioId]);
      expect([tabela, rows[0].n]).toEqual([tabela, 0]);
    }
  });

  test("o vinculo recorrencia -> lancamento sobrevive ao backup e nao duplica o mes atual", async () => {
    const origem = await criarUsuarioAutenticado(app);
    const { dia } = partesNoFuso();
    await request(app).post("/api/recorrencias").set(origem.headers)
      .send({ tipo: "despesa", descricao: "Aluguel", valor: 1000, diaMes: Math.max(1, Math.min(28, dia)) });
    await request(app).get("/api/dashboard/resumo").set(origem.headers); // gera o lancamento do mes
    const backup = (await request(app).get("/api/backup").set(origem.headers)).body;
    const gerada = backup.movimentacoes.find((m) => m.descricao === "Aluguel");
    expect(gerada.recorrenciaIndice).toBe(0); // exporta o vinculo

    const destino = await criarUsuarioAutenticado(app);
    const res = await request(app).post("/api/backup/restaurar").set(destino.headers).send(backup);
    expect(res.body.resultado).toMatchObject({ movimentacoes: 1, recorrencias: 1 });
    const { rows } = await pool.query("SELECT recorrencia_id FROM movimentacoes WHERE usuario_id = $1", [destino.usuarioId]);
    expect(rows[0].recorrencia_id).not.toBeNull(); // religado a recorrencia nova

    await request(app).get("/api/dashboard/resumo").set(destino.headers); // abrir o dashboard nao duplica
    const total = await pool.query("SELECT count(*)::int AS n FROM movimentacoes WHERE usuario_id = $1", [destino.usuarioId]);
    expect(total.rows[0].n).toBe(1);
  });

  test("backup ANTIGO (sem vinculo) tambem nao duplica o lancamento do mes atual", async () => {
    const { headers, usuarioId } = await criarUsuarioAutenticado(app);
    const { ano, mes, dia } = partesNoFuso();
    const hoje = `${ano}-${String(mes).padStart(2, "0")}-${String(Math.max(1, Math.min(28, dia))).padStart(2, "0")}`;
    await request(app).post("/api/backup/restaurar").set(headers).send(backupBase({
      movimentacoes: [mov(1, { descricao: "Aluguel", data: hoje })], // sem recorrenciaIndice (formato antigo)
      recorrencias: [{ tipo: "despesa", descricao: "Aluguel", valor: 1000, diaMes: Math.max(1, Math.min(28, dia)) }],
    }));
    await request(app).get("/api/dashboard/resumo").set(headers);
    const total = await pool.query("SELECT count(*)::int AS n FROM movimentacoes WHERE usuario_id = $1", [usuarioId]);
    expect(total.rows[0].n).toBe(1); // conservador: nao gera de novo no mes da restauracao
  });
});

describe("excluir categoria em uso pede confirmacao (BUG-10)", () => {
  async function categoriaComUso(headers) {
    const cat = (await request(app).post("/api/categorias").set(headers).send({ nome: "Mercado", tipo: "despesa" })).body.categoria;
    await request(app).post("/api/despesas").set(headers).send({ descricao: "Compras", valor: 50, data: "2026-03-01", categoriaId: cat.id });
    await request(app).post("/api/orcamentos").set(headers).send({ categoriaId: cat.id, valorLimite: 300 });
    return cat;
  }

  test("sem forcar: 409 com a contagem do que sera afetado, e nada e' apagado", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const cat = await categoriaComUso(headers);
    const res = await request(app).delete(`/api/categorias/${cat.id}`).set(headers);
    expect(res.status).toBe(409);
    expect(res.body.detalhes.emUso).toEqual({ movimentacoes: 1, recorrencias: 0, orcamentos: 1 });
    expect((await request(app).get("/api/categorias").set(headers)).body.categorias).toHaveLength(1);
  });

  test("com forcar=1: exclui, lancamento fica sem categoria e o orcamento some", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const cat = await categoriaComUso(headers);
    expect((await request(app).delete(`/api/categorias/${cat.id}?forcar=1`).set(headers)).status).toBe(204);
    const movs = (await request(app).get("/api/movimentacoes").set(headers)).body.movimentacoes;
    expect(movs[0].categoria_id).toBeNull();
    expect((await request(app).get("/api/orcamentos").set(headers)).body.orcamentos).toHaveLength(0);
  });

  test("categoria sem uso continua sendo excluida direto; inexistente e' 404", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const cat = (await request(app).post("/api/categorias").set(headers).send({ nome: "Vazia", tipo: "receita" })).body.categoria;
    expect((await request(app).delete(`/api/categorias/${cat.id}`).set(headers)).status).toBe(204);
    expect((await request(app).delete(`/api/categorias/${cat.id}`).set(headers)).status).toBe(404);
  });

  test("nao vaza nem afeta categoria de outra pessoa", async () => {
    const a = await criarUsuarioAutenticado(app);
    const b = await criarUsuarioAutenticado(app);
    const cat = await categoriaComUso(a.headers);
    expect((await request(app).delete(`/api/categorias/${cat.id}?forcar=1`).set(b.headers)).status).toBe(404);
    expect((await request(app).get("/api/categorias").set(a.headers)).body.categorias).toHaveLength(1);
  });
});

describe("CSV com virgula decimal (BUG-12)", () => {
  test("o valor sai como 1234,50 (o Excel em portugues le como numero)", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    await request(app).post("/api/despesas").set(headers).send({ descricao: "Mercado", valor: 1234.5, data: "2026-03-01" });
    await request(app).post("/api/despesas").set(headers).send({ descricao: "Pao", valor: 8, data: "2026-03-02" });
    const csv = (await request(app).get("/api/movimentacoes/exportar").set(headers)).text;
    expect(csv).toContain(";1234,50;");
    expect(csv).toContain(";8,00;");
    expect(csv).not.toMatch(/;\d+\.\d{2};/); // nenhum valor com ponto decimal
    const rel = (await request(app).get("/api/relatorios/exportar").set(headers)).text;
    expect(rel).toContain("1242,50");
  });
});

describe("bcrypt nativo, pool, migracao e indices", () => {
  test("bcrypt nativo confere hashes antigos ($2a$ do bcryptjs) e novos", async () => {
    const bcryptjs = require("bcryptjs");
    const antigo = await bcryptjs.hash("SenhaAntiga123", 4);
    expect(await senha.compare("SenhaAntiga123", antigo)).toBe(true);
    expect(await senha.compare("errada", antigo)).toBe(false);
    const novo = await senha.hash("SenhaNova456", 4);
    expect(novo).toMatch(/^\$2[aby]\$04\$/);
    expect(await senha.compare("SenhaNova456", novo)).toBe(true);
    expect(await bcryptjs.compare("SenhaNova456", novo)).toBe(true); // e o bcryptjs tambem le o novo
  });

  test("pool com limites e timeouts", () => {
    expect(pool.options.max).toBe(10);
    expect(pool.options.connectionTimeoutMillis).toBe(10000);
    expect(pool.options.idleTimeoutMillis).toBe(30000);
    expect(pool.options.statement_timeout).toBe(30000);
  });

  test("dois processos de migracao ao mesmo tempo terminam sem conflito (trava do PostgreSQL)", async () => {
    const rodar = () => new Promise((resolve) => {
      const filho = spawn(process.execPath, [path.join(__dirname, "..", "src", "database", "migrate.js")], { env: process.env });
      let saida = "";
      filho.stdout.on("data", (d) => { saida += d; });
      filho.stderr.on("data", (d) => { saida += d; });
      filho.on("exit", (codigo) => resolve({ codigo, saida }));
    });
    const [a, b] = await Promise.all([rodar(), rodar()]);
    expect([a.codigo, b.codigo]).toEqual([0, 0]);
    expect(a.saida + b.saida).toMatch(/concluido/);
  }, 60000);

  test("indices esperados existem", async () => {
    const { rows } = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_movimentacoes_usuario_tipo_data', 'uq_mov_recorrencia_mes', 'uq_usuarios_email_lower')"
    );
    expect(rows.map((r) => r.indexname).sort()).toEqual(["idx_movimentacoes_usuario_tipo_data", "uq_mov_recorrencia_mes", "uq_usuarios_email_lower"]);
  });

  test("grafico mensal considera so' os ultimos meses pedidos e continua correto", async () => {
    const { headers } = await criarUsuarioAutenticado(app);
    const { ano, mes } = partesNoFuso();
    const mm = String(mes).padStart(2, "0");
    await request(app).post("/api/despesas").set(headers).send({ descricao: "Agora", valor: 100, data: `${ano}-${mm}-01` });
    await request(app).post("/api/despesas").set(headers).send({ descricao: "Muito antiga", valor: 999, data: `${ano - 3}-01-10` });
    const res = await request(app).get("/api/dashboard/graficos?meses=6").set(headers);
    expect(res.status).toBe(200);
    expect(res.body.porMes).toHaveLength(6);
    const somaDespesas = res.body.porMes.reduce((s, m) => s + m.despesas, 0);
    expect(somaDespesas).toBe(100); // a de 3 anos atras fica fora da janela
    expect(res.body.porMes.at(-1).mes).toBe(`${ano}-${mm}`);
  });
});
