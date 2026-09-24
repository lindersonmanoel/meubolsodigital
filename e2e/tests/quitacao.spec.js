"use strict";

// Orcamentos: resumo do mes (receitas - limites) e calculadora de quitacao de dividas (so' simulacao, no navegador).
// Parte 1 testa o calculo puro (js/quitacao.js carregado sem navegador); parte 2 testa a tela.

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { test, expect } = require("@playwright/test");
const { api, criarConta, logarNoNavegador, observarProblemas } = require("./helpers");

const FONTE = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "js", "quitacao.js"), "utf8");
const Quitacao = vm.runInNewContext(`${FONTE}\n;Quitacao`, {});
const uma = (saldo, jurosMensal = 0, minima = 0, nome = "Cartao") => ({ nome, saldo, jurosMensal, minima });

test.describe("calculo de quitacao (sem navegador)", () => {
  test("sem juros: saldo dividido pelo valor mensal, arredondado pra cima", () => {
    const r = Quitacao.simular({ dividas: [uma(1000)], valorMensal: 250 });
    expect(r.possivel).toBe(true);
    expect(r.meses).toBe(4);
    expect(r.totalJuros).toBe(0);
    expect(r.totalPago).toBe(1000);
    expect(Quitacao.simular({ dividas: [uma(1000)], valorMensal: 300 }).meses).toBe(4);
  });

  test("com juros: bate com a conta feita a mao (1000 a 10% ao mes, 600 por mes)", () => {
    // mes 1: 1100 - 600 = 500; mes 2: 550 e quita pagando 550. juros = 100 + 50
    const r = Quitacao.simular({ dividas: [uma(1000, 10)], valorMensal: 600 });
    expect(r.meses).toBe(2);
    expect(r.totalJuros).toBe(150);
    expect(r.totalPago).toBe(1150);
  });

  test("quando os juros comem tudo o que se paga, nao quita e avisa (sem travar)", () => {
    const r = Quitacao.simular({ dividas: [uma(1000, 10)], valorMensal: 100 });
    expect(r.possivel).toBe(false);
    expect(r.avisos.join(" ")).toMatch(/juros/);
  });

  test("sem valor mensal ou sem dividas: resultado seguro", () => {
    expect(Quitacao.simular({ dividas: [uma(500)], valorMensal: 0 }).possivel).toBe(false);
    const vazio = Quitacao.simular({ dividas: [], valorMensal: 500 });
    expect(vazio.possivel).toBe(true);
    expect(vazio.meses).toBe(0);
    expect(Quitacao.simular({ dividas: [uma("abc"), uma(-5)], valorMensal: 500 }).meses).toBe(0);
  });

  test("bola de neve quita a menor primeiro; avalanche ataca o maior juros e paga menos juros", () => {
    const dividas = [uma(500, 2, 50, "Pequena"), uma(1000, 5, 50, "Cara")];
    const neve = Quitacao.simular({ dividas, valorMensal: 300, metodo: "bola-de-neve" });
    const aval = Quitacao.simular({ dividas, valorMensal: 300, metodo: "avalanche" });
    expect(neve.possivel && aval.possivel).toBe(true);
    expect(neve.ordem[0].nome).toBe("Pequena");
    expect(aval.ordem[0].nome).toBe("Cara");
    expect(aval.totalJuros).toBeLessThanOrEqual(neve.totalJuros);
    expect(neve.ordem).toHaveLength(2);
  });

  test("valor mensal menor que a soma das minimas gera aviso", () => {
    const r = Quitacao.simular({ dividas: [uma(1000, 1, 200), uma(1000, 1, 200)], valorMensal: 300 });
    expect(r.avisos.join(" ")).toMatch(/parcelas mínimas/);
  });

  test("pagar a mais reduz o prazo e os juros; rotulos de prazo e data", () => {
    const entrada = { dividas: [uma(5000, 3)], valorMensal: 400 };
    const e = Quitacao.economiaComExtra(entrada, 100);
    expect(e.mesesEconomizados).toBeGreaterThan(0);
    expect(e.jurosEconomizados).toBeGreaterThan(0);
    expect(Quitacao.rotuloPrazo(1)).toBe("1 mês");
    expect(Quitacao.rotuloPrazo(14)).toBe("14 meses (1 ano e 2 meses)");
    expect(Quitacao.mesAno(3, new Date(2026, 10, 15))).toBe("fev/2027");
  });
});

test.describe("tela de Orcamentos", () => {
  test("resumo do mes e calculadora acompanham os limites, sem enviar as dividas ao servidor", async ({ page, request }) => {
    const conta = await criarConta(request);
    const t = conta.token;
    const despesa = (await api(request, "POST", "/categorias", { nome: "Mercado", tipo: "despesa" }, t)).json.categoria;
    const receita = (await api(request, "POST", "/categorias", { nome: "Salario", tipo: "receita" }, t)).json.categoria;
    await logarNoNavegador(page, conta);
    const problemas = await observarProblemas(page);

    const hoje = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });
    await api(request, "POST", "/receitas", { descricao: "Salario", valor: 3000, data: hoje, categoriaId: receita.id }, t);
    await api(request, "POST", "/orcamentos", { categoriaId: despesa.id, valorLimite: 1000 }, t);

    const enviados = [];
    page.on("request", (r) => { if (r.method() !== "GET" && r.url().includes("/api/")) enviados.push(r.url()); });

    await page.goto("/orcamentos");
    await expect(page.locator("#resumo-sobra")).toContainText("2.000,00");
    await expect(page.locator("#quitacao-valor")).toHaveValue("2000");

    await page.click("#quitacao-add");
    const linha = page.locator(".quitacao-linha").first();
    await linha.locator("input").nth(0).fill("Cartao");
    await linha.locator("input").nth(1).fill("4000");
    await expect(page.locator("#quitacao-resultado")).toContainText("2 meses");

    // muda o limite: sobra e prazo se atualizam sozinhos
    await page.click('[data-acao="editar"]');
    await page.fill("#valorLimite", "1500");
    await page.click("#btn-salvar");
    await expect(page.locator("#resumo-sobra")).toContainText("1.500,00");
    await expect(page.locator("#quitacao-valor")).toHaveValue("1500");
    await expect(page.locator("#quitacao-resultado")).toContainText("3 meses");

    // valor proprio vence a sobra; e a lista de dividas volta depois de recarregar (localStorage)
    await page.fill("#quitacao-valor", "500");
    await expect(page.locator("#quitacao-resultado")).toContainText("8 meses");
    await page.reload();
    await expect(page.locator(".quitacao-linha input").nth(1)).toHaveValue("4000");
    await expect(page.locator("#quitacao-valor")).toHaveValue("500");
    await expect(page.locator("#quitacao-resultado")).toContainText("8 meses");

    // voltar para a sobra calculada
    await page.click("#quitacao-usar-sobra");
    await expect(page.locator("#quitacao-valor")).toHaveValue("1500");

    // nada foi enviado ao servidor por causa da calculadora (so' a edicao do limite: 1 PUT em /orcamentos/:id)
    expect(enviados.filter((u) => !u.includes("/orcamentos/"))).toEqual([]);
    const { csp, erros } = await problemas.coletar();
    expect({ csp, erros }).toEqual({ csp: [], erros: [] });
  });

  test("remover a divida atualiza o resultado; layout sem rolagem lateral", async ({ page, request }) => {
    const conta = await criarConta(request);
    await logarNoNavegador(page, conta);
    await page.goto("/orcamentos");
    await page.fill("#quitacao-valor", "300");
    await page.click("#quitacao-add");
    await page.click("#quitacao-add");
    await page.locator(".quitacao-linha").nth(0).locator("input").nth(1).fill("900");
    await page.locator(".quitacao-linha").nth(1).locator("input").nth(1).fill("300");
    await expect(page.locator("#quitacao-resultado")).toContainText("4 meses");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.locator(".quitacao-remover").nth(1).click();
    await expect(page.locator(".quitacao-linha")).toHaveCount(1);
    await expect(page.locator("#quitacao-resultado")).toContainText("3 meses");
  });
});
