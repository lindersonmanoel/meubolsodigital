"use strict";

const ExcelJS = require("exceljs");

const COR_CABECALHO = "FF0D3B66";
const COR_RECEITA = "FF1FA974";
const COR_DESPESA = "FFDC2626";

function estilizarCabecalho(linha) {
  linha.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
    celula.alignment = { vertical: "middle" };
  });
  linha.height = 20;
}

function autoLargura(planilha) {
  planilha.columns.forEach((coluna) => {
    let maior = 10;
    coluna.eachCell({ includeEmpty: true }, (celula) => {
      const tamanho = celula.value == null ? 0 : String(celula.value).length;
      if (tamanho > maior) maior = tamanho;
    });
    coluna.width = Math.min(maior + 2, 45);
  });
}

function planilhaMovimentacoes(workbook, titulo, movimentacoes) {
  const planilha = workbook.addWorksheet(titulo);
  planilha.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Descrição", key: "descricao", width: 30 },
    { header: "Categoria", key: "categoria_nome", width: 20 },
    { header: "Valor", key: "valor", width: 14 },
    { header: "Observação", key: "observacao", width: 30 },
  ];
  estilizarCabecalho(planilha.getRow(1));

  movimentacoes.forEach((m) => {
    const linha = planilha.addRow({
      data: formatarDataBR(m.data),
      tipo: m.tipo === "receita" ? "Receita" : "Despesa",
      descricao: m.descricao,
      categoria_nome: m.categoria_nome || "Sem categoria",
      valor: Number(m.valor),
      observacao: m.observacao || "",
    });
    const celulaValor = linha.getCell("valor");
    celulaValor.numFmt = '"R$" #,##0.00';
    celulaValor.font = { color: { argb: m.tipo === "receita" ? COR_RECEITA : COR_DESPESA }, bold: true };
  });

  autoLargura(planilha);
  planilha.views = [{ state: "frozen", ySplit: 1 }];
  return planilha;
}

function formatarDataBR(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Gera um .xlsx so' com as movimentacoes (usado por /movimentacoes|receitas|despesas/exportar-excel). */
async function gerarExcelMovimentacoes(movimentacoes, titulo) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Meu Bolso Digital";
  workbook.created = new Date();
  planilhaMovimentacoes(workbook, titulo || "Movimentações", movimentacoes);
  return workbook.xlsx.writeBuffer();
}

/** Gera o relatorio completo em .xlsx, organizado em varias abas: Resumo, Movimentacoes do
 * periodo, Despesas por categoria, Metas e Orcamentos - tudo automatico, sem precisar montar
 * planilha na mao. */
async function gerarExcelRelatorioCompleto({ periodo, resumo, movimentacoes, despesasPorCategoria, metas, orcamentos }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Meu Bolso Digital";
  workbook.created = new Date();

  // --- Resumo ---
  const pResumo = workbook.addWorksheet("Resumo");
  pResumo.columns = [{ key: "rotulo", width: 28 }, { key: "valor", width: 20 }];
  pResumo.addRow(["Meu Bolso Digital - Relatório financeiro"]).font = { bold: true, size: 14 };
  pResumo.mergeCells("A1:B1");
  if (periodo && (periodo.inicio || periodo.fim)) {
    pResumo.addRow(["Período", `${periodo.inicio || "início"} a ${periodo.fim || "hoje"}`]);
  }
  pResumo.addRow([]);
  const linhasResumo = [
    ["Total de receitas", resumo.totalReceitas],
    ["Total de despesas", resumo.totalDespesas],
    ["Saldo no período", resumo.saldoNoPeriodo],
    ["Saldo atual (geral)", resumo.saldoAtual],
    ["Quantidade de movimentações", resumo.quantidadeMovimentacoes],
  ];
  linhasResumo.forEach(([rotulo, valor]) => {
    const linha = pResumo.addRow([rotulo, valor]);
    linha.getCell(1).font = { bold: true };
    if (typeof valor === "number" && rotulo !== "Quantidade de movimentações") {
      linha.getCell(2).numFmt = '"R$" #,##0.00';
    }
  });
  if (resumo.categoriaComMaiorGasto) {
    pResumo.addRow([]);
    const linha = pResumo.addRow(["Categoria com maior gasto", `${resumo.categoriaComMaiorGasto.categoria} (R$ ${Number(resumo.categoriaComMaiorGasto.total).toFixed(2)})`]);
    linha.getCell(1).font = { bold: true };
  }

  // --- Movimentações do período ---
  if (movimentacoes && movimentacoes.length) {
    planilhaMovimentacoes(workbook, "Movimentações", movimentacoes);
  }

  // --- Despesas por categoria ---
  if (despesasPorCategoria && despesasPorCategoria.length) {
    const pCategorias = workbook.addWorksheet("Despesas por categoria");
    pCategorias.columns = [
      { header: "Categoria", key: "categoria", width: 26 },
      { header: "Total gasto", key: "total", width: 16 },
    ];
    estilizarCabecalho(pCategorias.getRow(1));
    despesasPorCategoria.forEach((c) => {
      const linha = pCategorias.addRow({ categoria: c.categoria, total: Number(c.total) });
      linha.getCell("total").numFmt = '"R$" #,##0.00';
    });
    autoLargura(pCategorias);
  }

  // --- Metas ---
  if (metas && metas.length) {
    const pMetas = workbook.addWorksheet("Metas");
    pMetas.columns = [
      { header: "Meta", key: "nome", width: 26 },
      { header: "Valor atual", key: "valor_atual", width: 15 },
      { header: "Objetivo", key: "valor_objetivo", width: 15 },
      { header: "Progresso", key: "progresso", width: 13 },
      { header: "Prazo", key: "prazo", width: 13 },
    ];
    estilizarCabecalho(pMetas.getRow(1));
    metas.forEach((m) => {
      const linha = pMetas.addRow({
        nome: m.nome,
        valor_atual: Number(m.valor_atual),
        valor_objetivo: Number(m.valor_objetivo),
        progresso: m.progresso / 100,
        prazo: formatarDataBR(m.prazo),
      });
      linha.getCell("valor_atual").numFmt = '"R$" #,##0.00';
      linha.getCell("valor_objetivo").numFmt = '"R$" #,##0.00';
      linha.getCell("progresso").numFmt = "0%";
    });
    autoLargura(pMetas);
  }

  // --- Orçamentos ---
  if (orcamentos && orcamentos.length) {
    const pOrcamentos = workbook.addWorksheet("Orçamentos");
    pOrcamentos.columns = [
      { header: "Categoria", key: "categoria_nome", width: 24 },
      { header: "Gasto no mês", key: "gasto_no_mes", width: 15 },
      { header: "Limite", key: "valor_limite", width: 15 },
      { header: "Percentual", key: "percentual", width: 13 },
      { header: "Situação", key: "situacao", width: 16 },
    ];
    estilizarCabecalho(pOrcamentos.getRow(1));
    const rotuloSituacao = { ok: "Dentro do limite", perto_do_limite: "Perto do limite", estourado: "Estourado" };
    orcamentos.forEach((o) => {
      const linha = pOrcamentos.addRow({
        categoria_nome: o.categoria_nome,
        gasto_no_mes: Number(o.gasto_no_mes),
        valor_limite: Number(o.valor_limite),
        percentual: o.percentual / 100,
        situacao: rotuloSituacao[o.situacao] || o.situacao,
      });
      linha.getCell("gasto_no_mes").numFmt = '"R$" #,##0.00';
      linha.getCell("valor_limite").numFmt = '"R$" #,##0.00';
      linha.getCell("percentual").numFmt = "0%";
      if (o.situacao === "estourado") linha.getCell("situacao").font = { color: { argb: COR_DESPESA }, bold: true };
    });
    autoLargura(pOrcamentos);
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { gerarExcelMovimentacoes, gerarExcelRelatorioCompleto };
