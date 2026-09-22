"use strict";

const Sessao = (function () {
  function salvar(token, usuario) {
    try {
      localStorage.setItem("mbd_token", token);
      localStorage.setItem("mbd_usuario", JSON.stringify(usuario));
    } catch (e) {
      // localStorage bloqueado (ex.: aba anonima restrita) - a sessao so dura a aba atual
    }
  }
  function usuario() {
    try {
      return JSON.parse(localStorage.getItem("mbd_usuario") || "null");
    } catch (e) {
      return null;
    }
  }
  function estaLogado() {
    try {
      return !!localStorage.getItem("mbd_token");
    } catch (e) {
      return false;
    }
  }
  function encerrar() {
    try {
      localStorage.removeItem("mbd_token");
      localStorage.removeItem("mbd_usuario");
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
  return { salvar, usuario, estaLogado, encerrar, exigirLogin, redirecionarSeLogado };
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
