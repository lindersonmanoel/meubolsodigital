"use strict";

// Registra o service worker (PWA). Silencioso se o navegador nao suportar.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // sem service worker o app continua funcionando normalmente, so sem modo offline
    });
  });
}
