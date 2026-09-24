"use strict";

const service = require("../services/categoria.service");

async function listar(req, res, next) {
  try {
    const categorias = await service.listar(req.usuarioId);
    res.json({ categorias });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const categoria = await service.criar(req.usuarioId, req.body || {});
    res.status(201).json({ categoria });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const categoria = await service.atualizar(req.usuarioId, req.params.id, req.body || {});
    res.json({ categoria });
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await service.remover(req.usuarioId, req.params.id, { forcar: req.query.forcar === "1" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, atualizar, remover };
