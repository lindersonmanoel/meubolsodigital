"use strict";

const service = require("../services/dashboard.service");
const movimentacaoService = require("../services/movimentacao.service");
const metaService = require("../services/meta.service");
const orcamentoService = require("../services/orcamento.service");
const { paraCsv, decimalBR } = require("../utils/csv");
const { gerarExcelRelatorioCompleto } = require("../utils/excel");

const COLUNAS_RELATORIO_CSV = [
  { chave: "categoria", rotulo: "Categoria" },
  { chave: "total", rotulo: "Total de despesas", formato: decimalBR, numerico: true },
];

async function resumo(req, res, next) {
  try {
    res.json(await service.resumo(req.usuarioId));
  } catch (err) {
    next(err);
  }
}

async function graficos(req, res, next) {
  try {
    const meses = Math.min(24, Math.max(1, Number(req.query.meses) || 6));
    res.json(await service.graficos(req.usuarioId, { meses }));
  } catch (err) {
    next(err);
  }
}

async function relatorio(req, res, next) {
  try {
    res.json(await service.relatorio(req.usuarioId, req.query));
  } catch (err) {
    next(err);
  }
}

async function relatorioCsv(req, res, next) {
  try {
    const dados = await service.relatorio(req.usuarioId, req.query);
    const csv = paraCsv(dados.despesasPorCategoria, COLUNAS_RELATORIO_CSV);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

/** Excel completo do relatorio: Resumo + Movimentacoes do periodo + Despesas por categoria +
 * Metas + Orcamentos, tudo organizado em abas separadas automaticamente. */
async function relatorioExcel(req, res, next) {
  try {
    const [resumo, movimentacoes, metas, orcamentos] = await Promise.all([
      service.relatorio(req.usuarioId, req.query),
      movimentacaoService.listar(req.usuarioId, req.query, {}),
      metaService.listar(req.usuarioId),
      orcamentoService.listar(req.usuarioId),
    ]);
    const buffer = await gerarExcelRelatorioCompleto({
      periodo: resumo.periodo,
      resumo,
      movimentacoes,
      despesasPorCategoria: resumo.despesasPorCategoria,
      metas,
      orcamentos,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-meu-bolso-digital.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { resumo, graficos, relatorio, relatorioCsv, relatorioExcel };
