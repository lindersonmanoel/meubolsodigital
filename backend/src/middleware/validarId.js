"use strict";

const { AppError } = require("../utils/errors");

/** Garante que :id da rota e um numero inteiro positivo antes de chegar no banco. */
function validarIdNaRota(req, _res, next) {
  if (!/^\d+$/.test(String(req.params.id))) {
    return next(new AppError("Identificador inválido.", 400));
  }
  return next();
}

module.exports = { validarIdNaRota };
