"use strict";

// Fluxos principais, no navegador (desktop e celular): cadastro, login, lancamentos, categoria em uso e troca de senha.

const { test, expect } = require("@playwright/test");
const { api, criarConta, logarNoNavegador } = require("./helpers");

test.describe("fluxos principais", () => {
  test("cadastro e login pela tela levam ao dashboard", async ({ page }) => {
    const email = `fluxo.${Date.now()}@example.com`;
    await page.goto("/cadastro");
    await page.fill("#nome", "Pessoa Fluxo");
    await page.fill("#email", email);
    await page.fill("#senha", "SenhaE2E-2026!");
    await page.fill("#confirmarSenha", "SenhaE2E-2026!");
    await page.click("#btn-criar");
    await expect(page.locator("#sucesso-geral")).toBeVisible();
    await page.waitForURL(/login/, { timeout: 15000 });

    await page.fill("#email", email);
    await page.fill("#senha", "SenhaE2E-2026!");
    await Promise.all([page.waitForURL(/dashboard/, { timeout: 20000 }), page.click("#btn-entrar")]);
    await expect(page.locator("#nome-usuario")).toContainText("Pessoa Fluxo");
  });

  test("login com senha errada mostra erro e nao entra", async ({ page, request }) => {
    const conta = await criarConta(request);
    await page.goto("/login");
    await page.fill("#email", conta.email);
    await page.fill("#senha", "senha-errada-123");
    await page.click("#btn-entrar");
    await expect(page.locator("#erro-geral")).toBeVisible();
    expect(page.url()).toMatch(/login/);
  });

  test("criar uma despesa pela tela, ve-la na lista e exclui-la", async ({ page, request }) => {
    const conta = await criarConta(request);
    await logarNoNavegador(page, conta);
    await page.goto("/despesas");
    await page.click("#btn-nova");
    await page.fill("#descricao", "Mercado E2E");
    await page.fill("#valor", "123.45");
    await page.fill("#data", "2026-03-10");
    await page.click("#btn-salvar");

    const linha = page.locator("#corpo-tabela tr", { hasText: "Mercado E2E" });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("123,45");

    page.once("dialog", (d) => d.accept());
    await linha.getByRole("button", { name: "Excluir" }).click();
    await expect(page.locator("#corpo-tabela tr", { hasText: "Mercado E2E" })).toHaveCount(0);
  });

  test("excluir categoria em uso avisa quantos itens serao afetados e so' exclui se confirmar", async ({ page, request }) => {
    const conta = await criarConta(request);
    const cat = (await api(request, "POST", "/categorias", { nome: "Mercado", tipo: "despesa" }, conta.token)).json.categoria;
    await api(request, "POST", "/despesas", { descricao: "Compras", valor: 50, data: "2026-03-01", categoriaId: cat.id }, conta.token);
    await logarNoNavegador(page, conta);
    await page.goto("/categorias");

    const dialogos = [];
    page.on("dialog", async (d) => { dialogos.push(d.message()); await d.accept(); });
    await page.locator("#corpo-tabela tr", { hasText: "Mercado" }).getByRole("button", { name: "Excluir" }).click();

    await expect.poll(() => dialogos.length).toBe(2); // 1o: "Excluir a categoria?"; 2o: "esta em uso: 1 movimentacao..."
    expect(dialogos[1]).toMatch(/em uso/);
    expect(dialogos[1]).toMatch(/1 movimentação/);
    await expect(page.locator("#corpo-tabela tr", { hasText: "Mercado" })).toHaveCount(0);
  });

  test.describe("criar categoria dentro do formulario", () => {
    const OPCAO_NOVA = "+ Criar nova categoria...";

    test("conta SEM categorias: cria uma no formulario de despesa, ela fica selecionada e e' usada no lancamento", async ({ page, request }) => {
      const conta = await criarConta(request); // NODE_ENV=test nao semeia categorias: conta vazia
      await logarNoNavegador(page, conta);
      await page.goto("/despesas");
      await page.click("#btn-nova");
      await expect(page.locator("#categoriaId")).toContainText("Sem categoria");
      await page.selectOption("#categoriaId", { label: OPCAO_NOVA });

      const caixa = page.locator(".categoria-rapida");
      await expect(caixa).toBeVisible();
      await caixa.locator("input").fill("Mercado");
      await caixa.getByRole("button", { name: "Criar" }).click();
      await expect(caixa).toBeHidden();
      await expect(page.locator("#categoriaId option:checked")).toHaveText("Mercado");

      await page.fill("#descricao", "Compras do mes");
      await page.fill("#valor", "10");
      await page.fill("#data", "2026-03-10");
      await page.click("#btn-salvar");
      await expect(page.locator("#corpo-tabela tr", { hasText: "Compras do mes" })).toContainText("Mercado");

      const { json } = await api(request, "GET", "/categorias", null, conta.token);
      expect(json.categorias.map((c) => `${c.nome}:${c.tipo}`)).toContain("Mercado:despesa");
    });

    test("Enter no campo de nome cria a categoria sem enviar o formulario principal; nome curto mostra erro", async ({ page, request }) => {
      const conta = await criarConta(request);
      await logarNoNavegador(page, conta);
      await page.goto("/despesas");
      await page.click("#btn-nova");
      await page.selectOption("#categoriaId", { label: OPCAO_NOVA });
      const entrada = page.locator(".categoria-rapida input");

      await entrada.fill("A");
      await entrada.press("Enter");
      await expect(page.locator(".categoria-rapida .erro-campo")).toContainText(/pelo menos 2/);

      await entrada.fill("Transporte");
      await entrada.press("Enter");
      await expect(page.locator("#categoriaId option:checked")).toHaveText("Transporte");
      await expect(page.locator("#corpo-tabela tr")).toHaveCount(0); // o Enter NAO salvou nenhuma despesa
    });

    test("cancelar volta para a selecao anterior e nome repetido mostra o erro do servidor", async ({ page, request }) => {
      const conta = await criarConta(request);
      await api(request, "POST", "/categorias", { nome: "Lazer", tipo: "despesa" }, conta.token);
      await logarNoNavegador(page, conta);
      await page.goto("/despesas");
      await page.click("#btn-nova");
      await page.selectOption("#categoriaId", { label: "Lazer" });
      await page.selectOption("#categoriaId", { label: OPCAO_NOVA });
      await page.locator(".categoria-rapida").getByRole("button", { name: "Cancelar" }).click();
      await expect(page.locator(".categoria-rapida")).toBeHidden();
      await expect(page.locator("#categoriaId option:checked")).toHaveText("Lazer");

      await page.selectOption("#categoriaId", { label: OPCAO_NOVA });
      await page.locator(".categoria-rapida input").fill("Lazer");
      await page.locator(".categoria-rapida").getByRole("button", { name: "Criar" }).click();
      await expect(page.locator(".categoria-rapida .erro-campo")).toContainText(/já tem uma categoria/i);
    });

    test("na tela de receitas a categoria criada e' do tipo receita", async ({ page, request }) => {
      const conta = await criarConta(request);
      await logarNoNavegador(page, conta);
      await page.goto("/receitas");
      await page.click("#btn-nova");
      await page.selectOption("#categoriaId", { label: OPCAO_NOVA });
      await page.locator(".categoria-rapida input").fill("Salario");
      await page.locator(".categoria-rapida").getByRole("button", { name: "Criar" }).click();
      await expect(page.locator("#categoriaId option:checked")).toHaveText("Salario");
      const { json } = await api(request, "GET", "/categorias", null, conta.token);
      expect(json.categorias.map((c) => `${c.nome}:${c.tipo}`)).toContain("Salario:receita");
    });

    test("orcamento: cria a categoria de despesa no proprio formulario e cria o orcamento", async ({ page, request }) => {
      const conta = await criarConta(request);
      await logarNoNavegador(page, conta);
      await page.goto("/orcamentos");
      await page.click("#btn-novo");
      await page.selectOption("#categoriaId", { label: OPCAO_NOVA });
      await page.locator(".categoria-rapida input").fill("Alimentacao");
      await page.locator(".categoria-rapida").getByRole("button", { name: "Criar" }).click();
      await expect(page.locator("#categoriaId option:checked")).toHaveText("Alimentacao");
      await page.fill("#valorLimite", "500");
      await page.click("#btn-salvar");
      await expect(page.locator("#lista-orcamentos")).toContainText("Alimentacao");
    });

    test("recorrencia: cria a categoria do tipo escolhido no formulario", async ({ page, request }) => {
      const conta = await criarConta(request);
      await logarNoNavegador(page, conta);
      await page.goto("/recorrencias");
      await page.click("#btn-nova");
      await page.selectOption("#tipo", "receita");
      await page.selectOption("#categoriaId", { label: OPCAO_NOVA });
      await page.locator(".categoria-rapida input").fill("Aluguel recebido");
      await page.locator(".categoria-rapida").getByRole("button", { name: "Criar" }).click();
      await expect(page.locator("#categoriaId option:checked")).toHaveText("Aluguel recebido");
      const { json } = await api(request, "GET", "/categorias", null, conta.token);
      expect(json.categorias.map((c) => `${c.nome}:${c.tipo}`)).toContain("Aluguel recebido:receita");
    });
  });

  test("errar a senha atual mostra o erro SEM deslogar; trocar a senha certa mantem a sessao", async ({ page, request }) => {
    const conta = await criarConta(request);
    await logarNoNavegador(page, conta);
    await page.goto("/configuracoes");

    await page.fill("#senhaAtual", "senha-atual-errada");
    await page.fill("#novaSenha", "OutraSenhaE2E-456!");
    await page.fill("#confirmarNovaSenha", "OutraSenhaE2E-456!");
    await page.click("#btn-trocar-senha");
    await expect(page.locator('.erro-campo[data-campo="senhaAtual"]')).toContainText(/incorret/i);
    expect(page.url()).toMatch(/configuracoes/); // continua logado

    const tokenAntes = await page.evaluate(() => localStorage.getItem("mbd_token"));
    await page.fill("#senhaAtual", conta.senha);
    await page.click("#btn-trocar-senha");
    await expect(page.locator("#sucesso-senha")).toBeVisible();
    const tokenDepois = await page.evaluate(() => localStorage.getItem("mbd_token"));
    expect(tokenDepois).not.toBe(tokenAntes); // guardou o token novo

    await page.reload();
    expect(page.url()).toMatch(/configuracoes/); // recarregar nao desloga
    // e o token ANTIGO deixou de valer no servidor
    const antigo = await api(request, "GET", "/auth/me", null, tokenAntes);
    expect(antigo.status).toBe(401);
  });

  test("o tour nao abre sozinho no dashboard (so' pelo botao ?)", async ({ page, request }) => {
    const conta = await criarConta(request);
    await page.addInitScript(([t, u]) => { localStorage.setItem("mbd_token", t); localStorage.setItem("mbd_usuario", JSON.stringify(u)); }, [conta.token, conta.usuario]);
    await page.goto("/dashboard"); // sem nenhuma chave de tour no localStorage
    await expect(page.locator("#nome-usuario")).toContainText(conta.nome);
    await expect(page.locator(".tour-overlay-top")).toHaveCount(0);
    await page.click("#btn-ajuda");
    await expect(page.locator(".tour-overlay-top")).toHaveCount(1); // o botao continua iniciando o tour
  });
});
