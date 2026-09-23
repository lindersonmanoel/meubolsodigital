"use strict";

const Sessao = (function () {
  const CHAVE_TOKEN = "mbd_token";
  const CHAVE_USUARIO = "mbd_usuario";

  // Em qual storage a sessao atual esta guardada (se houver) - usado quando "salvar" e'
  // chamado sem dizer explicitamente se e' pra lembrar ou nao (ex.: ao so' atualizar o
  // perfil), pra manter a escolha que a pessoa fez no login.
  function storageAtual() {
    try {
      if (localStorage.getItem(CHAVE_TOKEN)) return localStorage;
    } catch (e) {
      /* ignorado */
    }
    try {
      if (sessionStorage.getItem(CHAVE_TOKEN)) return sessionStorage;
    } catch (e) {
      /* ignorado */
    }
    return null;
  }

  /**
   * @param {boolean} [lembrar] true = localStorage (sobrevive a fechar o navegador),
   *   false = sessionStorage (sai ao fechar a aba). Omitido: mantem o tipo de
   *   armazenamento que a sessao atual ja estiver usando (ou localStorage se nenhuma).
   */
  function salvar(token, usuario, lembrar) {
    const persistente = lembrar !== undefined ? lembrar : storageAtual() !== sessionStorage;
    const principal = persistente ? localStorage : sessionStorage;
    const outro = persistente ? sessionStorage : localStorage;
    try {
      outro.removeItem(CHAVE_TOKEN);
      outro.removeItem(CHAVE_USUARIO);
      principal.setItem(CHAVE_TOKEN, token);
      principal.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
    } catch (e) {
      // storage bloqueado (ex.: aba anonima restrita) - a sessao so dura a aba atual
    }
  }
  function tokenAtual() {
    try {
      return localStorage.getItem(CHAVE_TOKEN) || sessionStorage.getItem(CHAVE_TOKEN) || "";
    } catch (e) {
      return "";
    }
  }
  function usuario() {
    try {
      const bruto = localStorage.getItem(CHAVE_USUARIO) || sessionStorage.getItem(CHAVE_USUARIO);
      return JSON.parse(bruto || "null");
    } catch (e) {
      return null;
    }
  }
  function estaLogado() {
    return !!tokenAtual();
  }
  function encerrar() {
    try {
      localStorage.removeItem(CHAVE_TOKEN);
      localStorage.removeItem(CHAVE_USUARIO);
      sessionStorage.removeItem(CHAVE_TOKEN);
      sessionStorage.removeItem(CHAVE_USUARIO);
    } catch (e) {
      /* nada a fazer */
    }
  }
  /** Chame no topo de paginas que exigem login. */
  function exigirLogin() {
    if (!estaLogado()) window.location.href = "login.html";
  }
  /** Chame no topo de login/cadastro: quem ja esta logado vai direto pro dashboard. */
  function redirecionarSeLogado() {
    if (estaLogado()) window.location.href = "dashboard.html";
  }
  return { salvar, tokenAtual, usuario, estaLogado, encerrar, exigirLogin, redirecionarSeLogado };
})();

function mostrarErro(elemento, mensagem) {
  elemento.textContent = mensagem || "";
  elemento.hidden = !mensagem;
}

function limparErrosCampos(form) {
  form.querySelectorAll(".erro-campo").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
}

function mostrarErrosCampos(form, campos) {
  Object.entries(campos || {}).forEach(([nome, mensagem]) => {
    const el = form.querySelector(`.erro-campo[data-campo="${nome}"]`);
    if (el) {
      el.textContent = mensagem;
      el.hidden = false;
    }
  });
}
