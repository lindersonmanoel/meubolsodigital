"use strict";

// Seguranca do frontend no navegador: CSP aplicada (sem violacoes nas telas), XSS via e-mail neutralizado,
// token de redefinicao fora da barra de endereco e cabecalhos de seguranca.

const { test, expect } = require("@playwright/test");
const { criarConta, logarNoNavegador, observarProblemas } = require("./helpers");

const TELAS = ["dashboard", "receitas", "despesas", "movimentacoes", "recorrencias", "orcamentos", "categorias", "metas", "relatorios", "configuracoes"];

test.describe("seguranca do frontend", () => {
  test("a Content-Security-Policy vale e nenhuma tela viola a propria politica", async ({ page, request }) => {
    const conta = await criarConta(request);
    await logarNoNavegador(page, conta);
    const problemas = await observarProblemas(page);

    for (const tela of TELAS) {
      await page.goto(`/${tela}`);
      await page.waitForLoadState("networkidle");
      await problemas.coletar();
    }
    expect(problemas.csp, `violacoes de CSP: ${problemas.csp.join(" | ")}`).toEqual([]);
    expect(problemas.erros, `erros de JavaScript: ${problemas.erros.join(" | ")}`).toEqual([]);
  });

  test("controle: script de origem proibida e' detectado e bloqueado pela CSP", async ({ page }) => {
    const problemas = await observarProblemas(page);
    await page.goto("/login");
    await page.evaluate(() => {
      window.__executou = false;
      const s = document.createElement("script");
      s.src = "https://origem-proibida.example/x.js";
      document.head.appendChild(s);
    });
    await expect.poll(async () => (await problemas.coletar()).csp.some((v) => v.includes("script-src"))).toBe(true);
  });

  test("cabecalhos de seguranca do site (os mesmos da Vercel)", async ({ page }) => {
    const resposta = await page.goto("/login");
    const h = resposta.headers();
    expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
    expect(h["content-security-policy"]).toMatch(/object-src 'none'/);
    expect(h["content-security-policy"]).toMatch(/connect-src 'self'/);
    expect(h["content-security-policy"]).not.toMatch(/cdn\.jsdelivr\.net/); // sem dependencia de CDN
  });

  test("e-mail com HTML guardado no navegador NAO executa script na barra superior (XSS)", async ({ page, request }) => {
    const conta = await criarConta(request);
    const maligno = '<img src=x onerror="window.__xss=1">@a.co';
    await page.addInitScript(([t, u, e]) => {
      localStorage.setItem("mbd_token", t);
      localStorage.setItem("mbd_usuario", JSON.stringify({ ...u, email: e }));
      localStorage.setItem("mbd_tour_visto", "1");
    }, [conta.token, conta.usuario, maligno]);
    await page.goto("/dashboard");
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.__xss === 1)).toBe(false);
    expect(await page.locator("#saudacao img").count()).toBe(0);
  });

  test("link de redefinicao de senha: o token sai da barra de endereco", async ({ page }) => {
    await page.goto("/redefinir-senha?token=abc123token");
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain("abc123token");
  });
});
