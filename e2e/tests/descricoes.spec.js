"use strict";

// Mantem as DESCRICOES do app em dia: meta description e subtitulo de cada tela, tour guiado e "Novidades".
// Estes testes falham quando alguem cria uma tela sem descricao/passo no tour, quando o tour aponta para algo que nao
// existe mais, ou quando a versao nao acompanha o historico. Checklist de mudanca: CONTRIBUINDO.md.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { test, expect } = require("@playwright/test");
const { criarConta, logarNoNavegador } = require("./helpers");

const FRONT = path.join(__dirname, "..", "..", "frontend");
const ler = (arquivo) => fs.readFileSync(path.join(FRONT, arquivo), "utf8");
const PAGINAS_HTML = fs.readdirSync(FRONT).filter((f) => f.endsWith(".html"));

// itens do menu lateral (shell.js) e passos do tour (tour.js), lidos direto do codigo-fonte
const MENU = [...ler("js/shell.js").matchAll(/href:\s*"([^"]+\.html)"/g)].map((m) => m[1]);
const PASSOS = [...ler("js/tour.js").matchAll(/pagina:\s*"([^"]+)",\s*seletor:\s*"([^"]+)",\s*titulo:\s*"([^"]+)",\s*texto:\s*"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => ({ pagina: m[1], seletor: m[2], titulo: m[3], texto: m[4] }));

function carregarVersao() {
  const janela = {};
  vm.runInNewContext(ler("js/versao.js"), { window: janela });
  return { versao: janela.APP_VERSION, historico: janela.CHANGELOG };
}
const comparar = (a, b) => {
  const x = a.split(".").map(Number); const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

test.describe("descricoes do site (sem navegador)", () => {
  test("todas as paginas tem <meta name=description> unica, entre 40 e 160 caracteres", () => {
    const vistas = new Map();
    for (const arquivo of PAGINAS_HTML) {
      const m = ler(arquivo).match(/<meta name="description" content="([^"]*)">/);
      expect(m, `${arquivo} nao tem meta description`).not.toBeNull();
      const texto = m[1];
      expect(texto.length, `${arquivo}: description com ${texto.length} caracteres`).toBeGreaterThanOrEqual(40);
      expect(texto.length, `${arquivo}: description com ${texto.length} caracteres (max 160)`).toBeLessThanOrEqual(160);
      expect(vistas.has(texto), `${arquivo} repete a description de ${vistas.get(texto)}`).toBe(false);
      vistas.set(texto, arquivo);
    }
  });

  test("todo item do menu tem passo no tour, e todo passo do tour aponta para uma tela do menu", () => {
    expect(MENU.length).toBeGreaterThanOrEqual(10);
    expect(PASSOS.length).toBeGreaterThanOrEqual(MENU.length);
    for (const pagina of MENU) {
      expect(PASSOS.some((p) => p.pagina === pagina), `${pagina} esta no menu mas nao tem passo no tour (js/tour.js)`).toBe(true);
    }
    for (const passo of PASSOS) {
      expect(MENU, `o passo "${passo.titulo}" aponta para ${passo.pagina}, que nao esta no menu`).toContain(passo.pagina);
      expect(passo.texto.length, `texto muito curto no passo "${passo.titulo}"`).toBeGreaterThanOrEqual(30);
    }
  });

  test("os passos do tour seguem a ordem do menu (o tour anda pelas telas na ordem em que aparecem)", () => {
    const ordem = PASSOS.map((p) => MENU.indexOf(p.pagina));
    expect(ordem, "ordem dos passos x menu").toEqual([...ordem].sort((a, b) => a - b));
  });

  test("versao: APP_VERSION e' a primeira do historico, em ordem decrescente e sem entradas vazias", () => {
    const { versao, historico } = carregarVersao();
    expect(historico.length).toBeGreaterThan(0);
    expect(versao).toBe(historico[0].versao);
    for (let i = 0; i < historico.length; i += 1) {
      expect(historico[i].mudancas.length, `versao ${historico[i].versao} sem mudancas`).toBeGreaterThan(0);
      expect(historico[i].data, `versao ${historico[i].versao} sem data ISO`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (i > 0) expect(comparar(historico[i - 1].versao, historico[i].versao), `${historico[i - 1].versao} deveria ser maior que ${historico[i].versao}`).toBeGreaterThan(0);
    }
  });
});

test.describe("descricoes do site (no navegador)", () => {
  test("cada tela do menu mostra titulo e subtitulo (descricao) preenchidos", async ({ page, request }) => {
    const conta = await criarConta(request);
    await logarNoNavegador(page, conta);
    for (const pagina of MENU) {
      await page.goto(`/${pagina.replace(".html", "")}`);
      await page.waitForLoadState("networkidle");
      const titulo = (await page.locator(".app-conteudo h1").first().textContent()).trim();
      const subtitulo = (await page.locator(".app-conteudo .barra-topo-pagina .hint").first().textContent()).trim();
      expect(titulo.length, `${pagina}: titulo vazio`).toBeGreaterThan(2);
      expect(subtitulo.length, `${pagina}: subtitulo (descricao) vazio ou curto demais`).toBeGreaterThanOrEqual(20);
    }
  });

  test("o elemento que cada passo do tour destaca existe e esta visivel na tela certa", async ({ page, request }) => {
    const conta = await criarConta(request);
    await logarNoNavegador(page, conta);
    for (const passo of PASSOS) {
      await page.goto(`/${passo.pagina.replace(".html", "")}`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator(passo.seletor).first(), `passo "${passo.titulo}": ${passo.seletor} nao existe em ${passo.pagina}`).toBeVisible();
    }
  });

  test("o tour percorre TODOS os passos, na ordem, e termina (sem reabrir depois)", async ({ page, request }) => {
    const conta = await criarConta(request);
    await page.addInitScript(([t, u]) => { localStorage.setItem("mbd_token", t); localStorage.setItem("mbd_usuario", JSON.stringify(u)); localStorage.setItem("mbd_faixa_instalar_fechada", "1"); }, [conta.token, conta.usuario]);
    await page.goto("/dashboard");
    await page.click("#btn-ajuda");

    for (let i = 0; i < PASSOS.length; i += 1) {
      await expect(page.locator(".tour-balao strong"), `passo ${i + 1}`).toHaveText(PASSOS[i].titulo, { timeout: 15000 });
      await expect(page.locator(".tour-balao .hint")).toContainText(`${i + 1} de ${PASSOS.length}`);
      await page.locator('.tour-balao [data-acao="avancar"]').click();
    }
    await expect(page.locator(".tour-balao")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("mbd_tour_visto"))).toBe("1");
    expect(await page.evaluate(() => localStorage.getItem("mbd_tour_passo"))).toBeNull();

    await page.goto("/dashboard"); // depois de concluir, o tour nao reabre
    await expect(page.locator("#nome-usuario")).toContainText(conta.nome);
    await expect(page.locator(".tour-overlay-top")).toHaveCount(0);
  });

  test("Configuracoes mostra a versao atual e as ultimas novidades (mesma fonte do aviso de atualizacao)", async ({ page, request }) => {
    const { versao, historico } = carregarVersao();
    const conta = await criarConta(request);
    await logarNoNavegador(page, conta);
    await page.goto("/configuracoes");
    await expect(page.locator("#versao-atual")).toHaveText(versao);
    await expect(page.locator("#lista-novidades")).toContainText(`Versão ${historico[0].versao}`);
    await expect(page.locator("#lista-novidades")).toContainText(historico[0].mudancas[0]);
    expect(await page.locator("#lista-novidades .novidade-item").count()).toBeLessThanOrEqual(4);
  });
});
