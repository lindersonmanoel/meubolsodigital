"use strict";

// Cartao "Novidades do app" (Configuracoes): mostra a versao atual e as ultimas atualizacoes, lidas de js/versao.js
// (window.APP_VERSION / window.CHANGELOG) - a MESMA fonte do aviso "nova versao disponivel". Assim, atualizar o
// versao.js a cada mudanca mantem a descricao do app em dia nos dois lugares.
// A tela e' montada por montarShell() (o conteudo vem de um <template>): chame renderizarNovidades() DEPOIS dele.
function renderizarNovidades() {
  const lista = document.getElementById("lista-novidades");
  const versao = document.getElementById("versao-atual");
  if (!lista || !window.CHANGELOG) return;
  lista.textContent = ""; // chamar de novo nao duplica
  if (versao) versao.textContent = window.APP_VERSION || "";

  const formatarData = (iso) => {
    const [ano, mes, dia] = String(iso || "").split("-");
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
  };

  window.CHANGELOG.slice(0, 4).forEach((item) => {
    const bloco = document.createElement("div");
    bloco.className = "novidade-item";

    const titulo = document.createElement("strong");
    titulo.textContent = `Versão ${item.versao}`;
    const data = document.createElement("span");
    data.className = "hint";
    data.textContent = item.data ? ` - ${formatarData(item.data)}` : "";

    const ul = document.createElement("ul");
    (item.mudancas || []).forEach((texto) => {
      const li = document.createElement("li");
      li.textContent = texto; // textContent: o texto nunca vira HTML
      ul.appendChild(li);
    });

    bloco.append(titulo, data, ul);
    lista.appendChild(bloco);
  });
}
