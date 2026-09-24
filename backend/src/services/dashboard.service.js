"use strict";

const movimentacaoModel = require("../models/movimentacao.model");
const recorrenciaService = require("./recorrencia.service");
const { dataValida } = require("../utils/datas");
const { inicioDoMesAtual } = require("../utils/fuso");

function periodoDoMesAtual() {
  return { inicio: inicioDoMesAtual() }; // primeiro dia do mes no fuso do app
}

async function resumo(usuarioId) {
  // Antes de calcular qualquer coisa, garante que as receitas/despesas fixas do mes atual
  // ja foram lancadas (sem isso, quem tem recorrencia mas nao mexeu em movimentacoes nao
  // veria o lançamento automatico refletido no saldo).
  await recorrenciaService.gerarDoMesAtual(usuarioId);

  const { inicio } = periodoDoMesAtual();
  const [saldo, doMes] = await Promise.all([
    movimentacaoModel.saldoTotal(usuarioId),
    movimentacaoModel.totaisPorTipo(usuarioId, { inicio }),
  ]);
  const receitas = doMes.receita.total;
  const despesas = doMes.despesa.total;
  return {
    saldoAtual: saldo,
    receitasDoMes: receitas,
    despesasDoMes: despesas,
    resultadoDoMes: Math.round((receitas - despesas) * 100) / 100,
  };
}

async function graficos(usuarioId, { meses = 6 } = {}) {
  const { inicio } = periodoDoMesAtual();
  const [porMes, despesasPorCategoria] = await Promise.all([
    movimentacaoModel.porMes(usuarioId, meses),
    movimentacaoModel.despesasPorCategoria(usuarioId, { inicio }),
  ]);
  return { porMes, despesasPorCategoriaNoMes: despesasPorCategoria };
}

function normalizarPeriodo(query) {
  const filtro = {};
  if (dataValida(query.inicio)) filtro.inicio = query.inicio;
  if (dataValida(query.fim)) filtro.fim = query.fim;
  return filtro;
}

async function relatorio(usuarioId, query) {
  const periodo = normalizarPeriodo(query);
  const [totais, saldo, porCategoria] = await Promise.all([
    movimentacaoModel.totaisPorTipo(usuarioId, periodo),
    movimentacaoModel.saldoTotal(usuarioId),
    movimentacaoModel.despesasPorCategoria(usuarioId, periodo),
  ]);
  const receitas = totais.receita.total;
  const despesas = totais.despesa.total;
  const categoriaComMaiorGasto = porCategoria[0] || null;
  return {
    periodo,
    totalReceitas: receitas,
    totalDespesas: despesas,
    saldoNoPeriodo: Math.round((receitas - despesas) * 100) / 100,
    saldoAtual: saldo,
    quantidadeMovimentacoes: totais.receita.quantidade + totais.despesa.quantidade,
    categoriaComMaiorGasto: categoriaComMaiorGasto
      ? { categoria: categoriaComMaiorGasto.categoria, total: categoriaComMaiorGasto.total }
      : null,
    despesasPorCategoria: porCategoria,
  };
}

module.exports = { resumo, graficos, relatorio };
