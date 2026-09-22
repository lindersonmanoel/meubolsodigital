"use strict";

const service = require("../services/dashboard.service");

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

module.exports = { resumo, graficos, relatorio };
