"use strict";

// Layout e usabilidade em CELULAR (iPhone 13, Pixel 5 e tela estreita de 320 px). Protege as correcoes de mobile:
// sem rolagem lateral, tabelas em cartoes, alvos de toque grandes, menu, PWA e teclado numerico.

const { test, expect } = require("@playwright/test");
const { api, criarConta, logarNoNavegador } = require("./helpers");

const PUBLICAS = ["login", "cadastro", "esqueci-senha"];
const LOGADAS = ["dashboard", "receitas", "despesas", "movimentacoes", "recorrencias", "orcamentos", "categorias", "metas", "relatorios", "configuracoes"];

const estouroLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function semear(request, conta) {
  const t = conta.token;
  const despesa = (await api(request, "POST", "/categorias", { nome: "Mercado", tipo: "despesa" }, t)).json.categoria;
  const receita = (await api(request, "POST", "/categorias", { nome: "Salario", tipo: "receita" }, t)).json.categoria;
  const descricoes = [
    "Supermercado Extra Hipermercado da Avenida Paulista numero 1000 - compras do mes completo",
    "Aluguel do apartamento", "Conta de luz", "Farmacia Sao Paulo - remedios e vitaminas", "Combustivel posto Shell",
  ];
  for (let i = 0; i < descricoes.length; i += 1) {
    await api(request, "POST", "/despesas", { descricao: descricoes[i], valor: 123.45 * (i + 1), data: `2026-03-${String(20 - i).padStart(2, "0")}`, categoriaId: despesa.id }, t);
  }
  await api(request, "POST", "/receitas", { descricao: "Salario", valor: 8500.5, data: "2026-03-05", categoriaId: receita.id }, t);
  await api(request, "POST", "/metas", { nome: "Viagem para a Europa no proximo ano com a familia toda", valorObjetivo: 25000, valorAtual: 7300.25, prazo: "2027-06-30" }, t);
  await api(request, "POST", "/orcamentos", { categoriaId: despesa.id, valorLimite: 900 }, t);
  await api(request, "POST", "/recorrencias", { tipo: "despesa", descricao: "Internet fibra 500 megas", valor: 129.9, diaMes: 10 }, t);
}

test.describe("layout de celular", () => {
  let conta;
  test.beforeAll(async ({ request }) => {
    conta = await criarConta(request);
    await semear(request, conta);
  });

  for (const pagina of PUBLICAS) {
    test(`tela publica ${pagina}: sem rolagem lateral`, async ({ page }) => {
      await page.goto(`/${pagina}`);
      await page.waitForLoadState("networkidle");
      expect(await estouroLateral(page)).toBeLessThanOrEqual(1);
    });
  }

  for (const pagina of LOGADAS) {
    test(`tela ${pagina}: sem rolagem lateral e sem tour aberto sozinho`, async ({ page }) => {
      await logarNoNavegador(page, conta);
      await page.goto(`/${pagina}`);
      await page.waitForLoadState("networkidle");
      expect(await estouroLateral(page)).toBeLessThanOrEqual(1);
      await expect(page.locator(".tour-overlay-top")).toHaveCount(0);
    });
  }

  test("tabelas viram cartoes: Valor e Editar/Excluir aparecem DENTRO da tela, sem rolar pro lado", async ({ page }) => {
    await logarNoNavegador(page, conta);
    for (const pagina of ["movimentacoes", "despesas", "recorrencias", "categorias"]) {
      await page.goto(`/${pagina}`);
      await page.waitForSelector("#corpo-tabela tr");
      const vw = page.viewportSize().width;
      const linha = page.locator("#corpo-tabela tr").first();
      const editar = linha.getByRole("button", { name: "Editar" });
      const excluir = linha.getByRole("button", { name: "Excluir" });
      for (const botao of [editar, excluir]) {
        const caixa = await botao.boundingBox();
        expect(caixa, `${pagina}: botao sem caixa`).not.toBeNull();
        expect(caixa.x + caixa.width, `${pagina}: botao passa da tela`).toBeLessThanOrEqual(vw + 1);
        expect(caixa.x).toBeGreaterThanOrEqual(0);
      }
      const valor = linha.locator('td[data-label="Valor"]');
      if (await valor.count()) {
        const caixa = await valor.boundingBox();
        expect(caixa.x + caixa.width, `${pagina}: valor passa da tela`).toBeLessThanOrEqual(vw + 1);
      }
      // o cabecalho da tabela fica escondido visualmente (a etiqueta de cada campo vem do data-label)
      const alturaCabecalho = await page.locator("table.tabela thead").first().evaluate((el) => el.getBoundingClientRect().height);
      expect(alturaCabecalho).toBeLessThanOrEqual(2);
    }
  });

  test("alvos de toque de pelo menos 40 px nos controles principais", async ({ page }) => {
    await logarNoNavegador(page, conta);
    await page.goto("/movimentacoes");
    await page.waitForSelector("#corpo-tabela tr");
    const seletores = ["#btn-menu", "#btn-ajuda", "#btn-nova", "#btn-exportar", "#corpo-tabela tr:first-child button"];
    for (const seletor of seletores) {
      const el = page.locator(seletor).first();
      if (!(await el.count())) continue;
      const caixa = await el.boundingBox();
      expect(caixa.height, `${seletor} tem ${Math.round(caixa.height)}px de altura`).toBeGreaterThanOrEqual(40);
      expect(caixa.width, `${seletor} tem ${Math.round(caixa.width)}px de largura`).toBeGreaterThanOrEqual(40);
    }
  });

  test("menu lateral abre pelo botao e fecha tocando no fundo", async ({ page }) => {
    await logarNoNavegador(page, conta);
    await page.goto("/dashboard");
    const sidebar = page.locator("#app-sidebar");
    await expect(sidebar).not.toHaveClass(/aberta/);
    await page.click("#btn-menu");
    await expect(sidebar).toHaveClass(/aberta/);
    const vw = page.viewportSize().width;
    await page.locator("#app-backdrop").click({ position: { x: vw - 8, y: 300 } }); // canto direito: fora do menu (240 px)
    await expect(sidebar).not.toHaveClass(/aberta/);
  });

  test("campos de valor abrem o teclado numerico (inputmode decimal)", async ({ page }) => {
    await logarNoNavegador(page, conta);
    for (const [pagina, id] of [["despesas", "valor"], ["receitas", "valor"], ["recorrencias", "valor"], ["orcamentos", "valorLimite"], ["metas", "valorObjetivo"]]) {
      await page.goto(`/${pagina}`);
      await expect(page.locator(`#${id}`)).toHaveAttribute("inputmode", "decimal");
    }
  });

  test("meta viewport com area segura e PWA com icones de 192 e 512", async ({ page, request }) => {
    await page.goto("/login");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    const resposta = await request.get("http://localhost:5500/manifest.json");
    const manifest = await resposta.json();
    expect(manifest.display).toBe("standalone");
    const icones = manifest.icons.map((i) => `${i.sizes}/${i.purpose || "any"}`);
    for (const esperado of ["192x192/any", "512x512/any", "192x192/maskable", "512x512/maskable"]) expect(icones).toContain(esperado);
    for (const i of manifest.icons) expect((await request.get(`http://localhost:5500/${i.src}`)).status()).toBe(200);
    expect(manifest.orientation).not.toBe("portrait-primary"); // nao trava o app em retrato
  });

  test("dashboard desenha os graficos com o Chart.js local (funciona offline no PWA)", async ({ page }) => {
    await logarNoNavegador(page, conta);
    await page.goto("/dashboard");
    await page.waitForFunction(() => typeof window.Chart === "function");
    const script = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => s.includes("chart")));
    expect(script).toMatch(/localhost:5500\/js\/vendor\/chart/); // nao vem mais de CDN
    await expect.poll(() => page.evaluate(() => ["grafico-meses", "grafico-categorias"].every((id) => document.getElementById(id).width > 0))).toBe(true);
  });
});
