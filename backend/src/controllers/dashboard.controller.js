"use strict";

const service = require("../services/dashboard.service");
const { paraCsv } = require("../utils/csv");

const COLUNAS_RELATORIO_CSV = [
  { chave: "categoria", rotulo: "Categoria" },
  { chave: "total", rotulo: "Total de despesas" },
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

module.exports = { resumo, graficos, relatorio, relatorioCsv };
