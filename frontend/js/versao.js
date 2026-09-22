"use strict";

// Numero da versao atual do app + historico do que mudou em cada uma. Usado pelo aviso de
// atualizacao automatica (ver pwa.js): quando uma versao nova do service worker termina de
// instalar, mostra pra pessoa qual e' essa versao e um resumo do que mudou.
window.APP_VERSION = "1.4.0";

window.CHANGELOG = [
  {
    versao: "1.4.0",
    data: "2026-09-22",
    mudancas: [
      "Aviso automático de atualização (este aqui!)",
      "Revisão geral: correções de bugs, responsividade no celular e performance",
      "Ícone do app redesenhado (ficava cortado/quadrado ao instalar)",
    ],
  },
  {
    versao: "1.3.0",
    data: "2026-09-22",
    mudancas: ["Tour guiado explicando cada tela do site (botão \"?\" no topo)"],
  },
  {
    versao: "1.2.0",
    data: "2026-09-22",
    mudancas: [
      "Instalar o app no celular, tablet, Windows e Mac, com passo a passo",
      "Receitas e despesas fixas recorrentes (lançam sozinhas todo mês)",
      "Orçamento mensal por categoria, com aviso quando estourar",
      "Exportar movimentações e relatórios em CSV/PDF",
    ],
  },
  {
    versao: "1.1.0",
    data: "2026-09-22",
    mudancas: ["Publicação do app (Vercel + Railway), fora do computador local pela primeira vez"],
  },
  {
    versao: "1.0.0",
    data: "2026-09-22",
    mudancas: ["Primeira versão completa: receitas, despesas, categorias, dashboard, metas e relatórios"],
  },
];
