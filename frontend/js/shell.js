"use strict";

// Menu lateral compartilhado por todas as paginas logadas. Cada pagina define seu
// conteudo dentro de <template id="conteudo-pagina"> e chama montarShell("chave-da-pagina").
const NAV_ITENS = [
  { href: "dashboard.html", pagina: "dashboard", rotulo: "Dashboard", icone: "📊" },
  { href: "receitas.html", pagina: "receitas", rotulo: "Receitas", icone: "💰" },
  { href: "despesas.html", pagina: "despesas", rotulo: "Despesas", icone: "💸" },
  { href: "movimentacoes.html", pagina: "movimentacoes", rotulo: "Movimentações", icone: "📋" },
  { href: "categorias.html", pagina: "categorias", rotulo: "Categorias", icone: "🏷️" },
  { href: "metas.html", pagina: "metas", rotulo: "Metas", icone: "🎯" },
  { href: "relatorios.html", pagina: "relatorios", rotulo: "Relatórios", icone: "📈" },
  { href: "configuracoes.html", pagina: "configuracoes", rotulo: "Configurações", icone: "⚙️" },
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
        <div class="marca"><img src="assets/images/logo.png" alt=""><span>Meu Bolso Digital</span></div>
        <nav class="sidebar-nav">${itensHtml}</nav>
        <button type="button" class="btn sidebar-sair" id="btn-sair">Sair</button>
      </aside>
      <div class="app-backdrop" id="app-backdrop" hidden></div>
      <div class="app-main">
        <header class="app-topbar">
          <button type="button" class="app-menu-btn" id="btn-menu" aria-label="Abrir menu">☰</button>
          <span class="hint" id="saudacao">${cache ? cache.email : ""}</span>
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
