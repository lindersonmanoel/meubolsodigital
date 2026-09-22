"use strict";

// Registra o service worker (PWA) e guarda o evento de instalacao pra qualquer pagina poder
// oferecer um botao "Instalar app" (Chrome/Edge no Windows, Mac, Android e a maioria dos
// navegadores baseados em Chromium). Safari (iPhone/iPad/Mac) nao dispara esse evento - por
// isso o Instalador tambem mostra o passo a passo manual (ver configuracoes.html).
if ("serviceWorker" in navigator) {
  // Se ja' havia um service worker controlando a pagina quando ela carregou, uma troca de
  // controlador depois disso e' uma ATUALIZACAO de verdade (nao a primeira instalacao) -
  // e' o gatilho do aviso "nova versao disponivel".
  let controladorAntesDeAtualizar = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controladorAntesDeAtualizar) mostrarAvisoAtualizacao();
    controladorAntesDeAtualizar = navigator.serviceWorker.controller;
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // sem service worker o app continua funcionando normalmente, so sem modo offline
    });
  });
}

/** Mostra "nova versao disponivel" com a versao e um resumo do que mudou (ver versao.js),
 * e um botao pra recarregar a pagina e usar a versao nova. */
function mostrarAvisoAtualizacao() {
  if (document.querySelector(".faixa-atualizacao")) return;
  const ultima = (window.CHANGELOG && window.CHANGELOG[0]) || null;
  const versao = ultima ? ultima.versao : "";
  const mudancas = ultima ? ultima.mudancas : [];

  const faixa = document.createElement("section");
  faixa.className = "faixa-instalar faixa-atualizacao";
  faixa.innerHTML = `
    <div class="faixa-instalar-linha">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icone-faixa-instalar"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
      <div class="texto-faixa-instalar">
        <strong>Nova versão disponível${versao ? ` (v${versao})` : ""}</strong>
        ${mudancas.length ? `<span class="hint">${mudancas[0]}</span>` : ""}
      </div>
      <button type="button" class="btn btn-primario" data-acao="atualizar" style="width:auto;padding:8px 16px">Atualizar agora</button>
      <button type="button" class="fechar-faixa-instalar" aria-label="Fechar aviso de atualização" data-acao="fechar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    ${
      mudancas.length > 1
        ? `<ul class="lista-mudancas">${mudancas.map((m) => `<li>${m}</li>`).join("")}</ul>`
        : ""
    }
  `;
  document.body.appendChild(faixa);

  faixa.querySelector('[data-acao="atualizar"]').addEventListener("click", () => window.location.reload());
  faixa.querySelector('[data-acao="fechar"]').addEventListener("click", () => faixa.remove());
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

  const ICONE_CELULAR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
  const ICONE_MONITOR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';

  const INSTRUCOES = {
    android: { titulo: `${ICONE_CELULAR} Celular/tablet Android (Chrome)`, passos: ['Toque nos três pontinhos (⋮) no canto superior direito do Chrome.', 'Toque em "Instalar aplicativo" (ou "Adicionar à tela inicial").', "Confirme - o ícone aparece na tela inicial."] },
    ios: { titulo: `${ICONE_CELULAR} iPhone/iPad (Safari)`, passos: ["Abra este site no Safari (não funciona no Chrome do iPhone).", "Toque no ícone de compartilhar (quadrado com seta pra cima).", 'Role e toque em "Adicionar à Tela de Início", depois em "Adicionar".'] },
    desktop: { titulo: `${ICONE_MONITOR} Windows (Chrome/Edge)`, passos: ["Clique no ícone de instalar na barra de endereço (um monitor com seta, ou ⊕).", 'Clique em "Instalar". O app abre numa janela própria.'] },
    mac: { titulo: `${ICONE_MONITOR} Mac (Chrome/Edge/Safari)`, passos: ["Chrome/Edge: use o ícone de instalar na barra de endereço.", 'Safari: menu Arquivo → "Adicionar ao Dock".'] },
  };

  function htmlInstrucoes() {
    const ordem = [plataforma(), ...Object.keys(INSTRUCOES).filter((p) => p !== plataforma())];
    return ordem
      .map((chave, i) => {
        const info = INSTRUCOES[chave];
        return `<details${i === 0 ? " open" : ""}><summary>${info.titulo}</summary><ol>${info.passos.map((p) => `<li>${p}</li>`).join("")}</ol></details>`;
      })
      .join("");
  }

  /** Monta a faixa "instale o app" dentro do elemento informado. Funciona em qualquer
   * pagina, logada ou nao (login/cadastro inclusive) - as instrucoes ficam embutidas ali
   * mesmo, sem depender de nenhuma outra pagina. */
  function montarFaixa(container) {
    if (!container || jaInstalado()) return;
    try {
      if (localStorage.getItem("mbd_faixa_instalar_fechada") === "1") return;
    } catch (e) {
      /* sem localStorage, mostra a faixa mesmo assim */
    }

    const faixa = document.createElement("section");
    faixa.className = "faixa-instalar";
    faixa.innerHTML = `
      <div class="faixa-instalar-linha">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icone-faixa-instalar"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <div class="texto-faixa-instalar">
          <strong>Instale o Meu Bolso Digital</strong>
          <span class="hint">Abre mais rápido, com ícone próprio, no celular ou computador.</span>
        </div>
        <button type="button" class="btn btn-primario" data-acao="instalar" style="width:auto;padding:8px 16px" hidden>Instalar agora</button>
        <button type="button" class="btn btn-secundario" data-acao="como-instalar" style="width:auto;padding:8px 16px">Como instalar</button>
        <button type="button" class="fechar-faixa-instalar" aria-label="Fechar aviso de instalação" data-acao="fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="instrucoes-instalar" data-painel-instrucoes hidden>${htmlInstrucoes()}</div>
    `;
    container.prepend(faixa);

    const btnInstalar = faixa.querySelector('[data-acao="instalar"]');
    btnInstalar.hidden = !disponivel();
    document.addEventListener("mbd:instalar-disponivel", () => { btnInstalar.hidden = false; });
    document.addEventListener("mbd:instalado", () => faixa.remove());

    btnInstalar.addEventListener("click", async () => {
      btnInstalar.disabled = true;
      const resultado = await instalar();
      btnInstalar.disabled = false;
      if (resultado === "accepted") faixa.remove();
    });

    const painel = faixa.querySelector("[data-painel-instrucoes]");
    faixa.querySelector('[data-acao="como-instalar"]').addEventListener("click", () => {
      painel.hidden = !painel.hidden;
    });

    faixa.querySelector('[data-acao="fechar"]').addEventListener("click", () => {
      faixa.remove();
      try {
        localStorage.setItem("mbd_faixa_instalar_fechada", "1");
      } catch (e) {
        /* nada a fazer */
      }
    });
  }

  return { disponivel, jaInstalado, instalar, plataforma, montarFaixa };
})();
