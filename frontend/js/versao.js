"use strict";

// Numero da versao atual do app + historico do que mudou em cada uma. Usado pelo aviso de
// atualizacao automatica (ver pwa.js): quando uma versao nova do service worker termina de
// instalar, mostra pra pessoa qual e' essa versao e um resumo do que mudou.
window.APP_VERSION = "1.9.0";

window.CHANGELOG = [
  {
    versao: "1.9.0",
    data: "2026-09-24",
    mudancas: [
      "Celular: as listas viram cartões com valor e botões sempre visíveis, botões maiores e teclado numérico nos valores",
      "Corrige o tour guiado, que reabria sozinho toda vez que o dashboard carregava",
      "Errar a senha atual em Configurações não desloga mais; melhorias de segurança e no modo offline",
    ],
  },
  {
    versao: "1.8.0",
    data: "2026-09-22",
    mudancas: [
      "Backup e restauração completos em Configurações (baixe tudo num arquivo e restaure quando precisar)",
      "Corrige a data errada nos arquivos exportados (CSV e Excel)",
    ],
  },
  {
    versao: "1.7.0",
    data: "2026-09-22",
    mudancas: [
      "Exportar em Excel (.xlsx) de verdade, com formatação",
      "Relatório completo em Excel com várias abas: Resumo, Movimentações, Despesas por categoria, Metas e Orçamentos",
    ],
  },
  {
    versao: "1.6.0",
    data: "2026-09-22",
    mudancas: [
      "Foto de perfil (com recorte/redimensionamento automático) e campo de bio em Configurações",
    ],
  },
  {
    versao: "1.5.5",
    data: "2026-09-22",
    mudancas: ["Botão do tour vira retângulo (cantos levemente arredondados), em vez de círculo"],
  },
  {
    versao: "1.5.4",
    data: "2026-09-22",
    mudancas: ["Botão do tour (\"?\") ficou verde, com a dica \"Iniciar tour\" ao passar o mouse"],
  },
  {
    versao: "1.5.3",
    data: "2026-09-22",
    mudancas: ["Diminui o tamanho das formas decorativas do fundo (estavam grandes demais)"],
  },
  {
    versao: "1.5.2",
    data: "2026-09-22",
    mudancas: ["Corrige o contraste do texto de apresentação no login/cadastro (estava cinza claro demais)"],
  },
  {
    versao: "1.5.1",
    data: "2026-09-22",
    mudancas: ["Ilustração decorativa (carteira, gráfico e seta) no fundo do login/cadastro"],
  },
  {
    versao: "1.5.0",
    data: "2026-09-22",
    mudancas: [
      "Telas de login e cadastro redesenhadas (visual novo, com ícones nos campos e botão de mostrar senha)",
    ],
  },
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
