"use strict";

// Menu lateral compartilhado por todas as paginas logadas. Cada pagina define seu
// conteudo dentro de <template id="conteudo-pagina"> e chama montarShell("chave-da-pagina").
// Icones em SVG (linha, estilo Feather) em vez de emoji - fica igual em qualquer
// sistema/navegador, sem depender da fonte de emoji instalada.
const SVG_ABRE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONES = {
  dashboard: `${SVG_ABRE}<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  receitas: `${SVG_ABRE}<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  despesas: `${SVG_ABRE}<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  movimentacoes: `${SVG_ABRE}<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  recorrencias: `${SVG_ABRE}<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  orcamentos: `${SVG_ABRE}<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  categorias: `${SVG_ABRE}<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`,
  metas: `${SVG_ABRE}<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  relatorios: `${SVG_ABRE}<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  configuracoes: `${SVG_ABRE}<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
  menu: `${SVG_ABRE}<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  sair: `${SVG_ABRE}<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

const NAV_ITENS = [
  { href: "dashboard.html", pagina: "dashboard", rotulo: "Dashboard", icone: ICONES.dashboard },
  { href: "receitas.html", pagina: "receitas", rotulo: "Receitas", icone: ICONES.receitas },
  { href: "despesas.html", pagina: "despesas", rotulo: "Despesas", icone: ICONES.despesas },
  { href: "movimentacoes.html", pagina: "movimentacoes", rotulo: "Movimentações", icone: ICONES.movimentacoes },
  { href: "recorrencias.html", pagina: "recorrencias", rotulo: "Recorrências", icone: ICONES.recorrencias },
  { href: "orcamentos.html", pagina: "orcamentos", rotulo: "Orçamentos", icone: ICONES.orcamentos },
  { href: "categorias.html", pagina: "categorias", rotulo: "Categorias", icone: ICONES.categorias },
  { href: "metas.html", pagina: "metas", rotulo: "Metas", icone: ICONES.metas },
  { href: "relatorios.html", pagina: "relatorios", rotulo: "Relatórios", icone: ICONES.relatorios },
  { href: "configuracoes.html", pagina: "configuracoes", rotulo: "Configurações", icone: ICONES.configuracoes },
];

function montarShell(paginaAtiva) {
  const cache = Sessao.usuario();

  const itensHtml = NAV_ITENS.map(
    (item) => `
      <a href="${item.href}" class="sidebar-link${item.pagina === paginaAtiva ? " ativo" : ""}">
        <span class="sidebar-icone" aria-hidden="true">${item.icone}</span>${item.rotulo}
      </a>`
  ).join("");

  document.body.insertAdjacentHTML(
    "afterbegin",
    `
    <div class="app-shell">
      <aside class="app-sidebar" id="app-sidebar">
        <div class="marca"><img src="assets/images/logo-icon.png" alt=""><span>Meu Bolso Digital</span></div>
        <nav class="sidebar-nav">${itensHtml}</nav>
        <button type="button" class="btn sidebar-sair" id="btn-sair"><span class="sidebar-icone" aria-hidden="true">${ICONES.sair}</span>Sair</button>
      </aside>
      <div class="app-backdrop" id="app-backdrop" hidden></div>
      <div class="app-main">
        <header class="app-topbar">
          <button type="button" class="app-menu-btn" id="btn-menu" aria-label="Abrir menu">${ICONES.menu}</button>
          <div class="app-topbar-direita">
            <span class="hint" id="saudacao">${cache ? cache.email : ""}</span>
            <button type="button" class="btn-ajuda-tour" id="btn-ajuda" title="Fazer um tour guiado pelo site" aria-label="Fazer um tour guiado pelo site">?</button>
          </div>
        </header>
        <main class="app-conteudo" id="app-conteudo"></main>
      </div>
    </div>
  `
  );

  const template = document.getElementById("conteudo-pagina");
  const alvo = document.getElementById("app-conteudo");
  if (template) {
    alvo.appendChild(template.content.cloneNode(true));
    template.remove();
  }

  document.getElementById("btn-sair").addEventListener("click", async () => {
    try {
      await Api.logout();
    } catch (e) {
      // mesmo se falhar no servidor, encerra a sessao localmente
    }
    Sessao.encerrar();
    window.location.href = "login.html";
  });

  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("app-backdrop");
  function fecharMenu() {
    sidebar.classList.remove("aberta");
    backdrop.hidden = true;
  }
  document.getElementById("btn-menu").addEventListener("click", () => {
    const abrindo = !sidebar.classList.contains("aberta");
    sidebar.classList.toggle("aberta", abrindo);
    backdrop.hidden = !abrindo;
  });
  backdrop.addEventListener("click", fecharMenu);
  sidebar.querySelectorAll(".sidebar-link").forEach((link) => link.addEventListener("click", fecharMenu));

  document.getElementById("btn-ajuda").addEventListener("click", () => {
    if (typeof Tour !== "undefined") Tour.iniciar();
  });
  if (typeof Tour !== "undefined") Tour.verificarAoCarregar();

  // Confere com o servidor que o token ainda e valido (pode ter expirado ou sido revogado).
  Api.me()
    .then(({ usuario }) => {
      document.getElementById("saudacao").textContent = usuario.email;
    })
    .catch((err) => {
      if (err.status === 401) {
        Sessao.encerrar();
        window.location.href = "login.html";
      }
    });

  return alvo;
}

/** Formata um numero como moeda brasileira (R$ 1.234,56). */
function formatarMoeda(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata "2026-03-05" como "05/03/2026", sem passar por Date (evita fuso horario). */
function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
