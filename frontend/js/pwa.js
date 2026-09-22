"use strict";

// Registra o service worker (PWA) e guarda o evento de instalacao pra qualquer pagina poder
// oferecer um botao "Instalar app" (Chrome/Edge no Windows, Mac, Android e a maioria dos
// navegadores baseados em Chromium). Safari (iPhone/iPad/Mac) nao dispara esse evento - por
// isso o Instalador tambem mostra o passo a passo manual (ver configuracoes.html).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // sem service worker o app continua funcionando normalmente, so sem modo offline
    });
  });
}

const Instalador = (function () {
  let eventoAdiado = null;

  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    eventoAdiado = evento;
    document.dispatchEvent(new CustomEvent("mbd:instalar-disponivel"));
  });

  window.addEventListener("appinstalled", () => {
    eventoAdiado = null;
    document.dispatchEvent(new CustomEvent("mbd:instalado"));
  });

  function disponivel() {
    return !!eventoAdiado;
  }

  /** Ja esta rodando instalado (modo standalone)? Cobre Chromium e Safari/iOS. */
  function jaInstalado() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  async function instalar() {
    if (!eventoAdiado) return null;
    eventoAdiado.prompt();
    const resultado = await eventoAdiado.userChoice;
    eventoAdiado = null;
    return resultado.outcome; // "accepted" | "dismissed"
  }

  /** Deteccao simples de plataforma, so' pra mostrar o passo a passo certo primeiro. */
  function plataforma() {
    const ua = navigator.userAgent || "";
    const ehIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    if (ehIOS) return "ios";
    if (/android/i.test(ua)) return "android";
    if (ua.includes("Macintosh")) return "mac";
    return "desktop";
  }

  return { disponivel, jaInstalado, instalar, plataforma };
})();
