"use strict";

const service = require("../services/recorrencia.service");

async function listar(req, res, next) {
  try {
    res.json({ recorrencias: await service.listar(req.usuarioId) });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    res.status(201).json({ recorrencia: await service.criar(req.usuarioId, req.body || {}) });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    res.json({ recorrencia: await service.atualizar(req.usuarioId, req.params.id, req.body || {}) });
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await service.remover(req.usuarioId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, atualizar, remover };
