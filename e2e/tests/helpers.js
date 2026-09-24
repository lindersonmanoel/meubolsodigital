"use strict";

const API = process.env.E2E_API_URL || "http://localhost:3000/api";
const ORIGEM = "http://localhost:5500";
let contador = 0;

/** Chamada direta a API (sem navegador), com a origem do site pra passar no CORS. */
async function api(request, metodo, caminho, corpo, token) {
  const resposta = await request.fetch(API + caminho, {
    method: metodo,
    headers: { Origin: ORIGEM, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    // so' manda corpo quando ha: um GET com "null" de corpo faz o parser JSON responder 400 antes de olhar o token
    ...(corpo != null ? { data: corpo } : {}),
  });
  let json = null;
  try { json = await resposta.json(); } catch (e) { /* 204 etc. */ }
  return { status: resposta.status(), json };
}

/** Cria uma conta nova (e-mail unico) e devolve { email, senha, token, usuario }. */
async function criarConta(request, overrides = {}) {
  contador += 1;
  const dados = {
    nome: overrides.nome || `Pessoa E2E ${contador}`,
    email: overrides.email || `e2e.${Date.now()}.${contador}@example.com`,
    senha: overrides.senha || "SenhaE2E-2026!",
  };
  const cadastro = await api(request, "POST", "/auth/register", { ...dados, confirmarSenha: dados.senha });
  if (cadastro.status !== 201) throw new Error(`cadastro falhou: ${cadastro.status} ${JSON.stringify(cadastro.json)}`);
  const login = await api(request, "POST", "/auth/login", { email: dados.email, senha: dados.senha });
  return { ...dados, token: login.json.token, usuario: login.json.usuario };
}

/** Deixa o navegador "logado" (token no localStorage) sem passar pela tela de login; tour e faixa de instalar ja vistos. */
async function logarNoNavegador(page, conta) {
  await page.addInitScript(([token, usuario]) => {
    try {
      localStorage.setItem("mbd_token", token);
      localStorage.setItem("mbd_usuario", JSON.stringify(usuario));
      localStorage.setItem("mbd_tour_visto", "1");
      localStorage.setItem("mbd_faixa_instalar_fechada", "1");
    } catch (e) { /* storage bloqueado */ }
  }, [conta.token, conta.usuario]);
}

/** Registra violacoes de CSP e erros de script da pagina, pra o teste conferir no fim. */
async function observarProblemas(page) {
  const problemas = { csp: [], erros: [] };
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.effectiveDirective} <- ${e.blockedURI || "inline"}`));
  });
  page.on("pageerror", (e) => problemas.erros.push(e.message));
  problemas.coletar = async () => {
    const v = await page.evaluate(() => window.__csp || []).catch(() => []);
    v.forEach((x) => { if (!problemas.csp.includes(x)) problemas.csp.push(x); });
    return problemas;
  };
  return problemas;
}

module.exports = { api, criarConta, logarNoNavegador, observarProblemas, API, ORIGEM };
