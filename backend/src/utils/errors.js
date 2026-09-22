"use strict";

/** Erro de aplicacao com status HTTP e (opcionalmente) campos de validacao, pronto pra virar JSON. */
class AppError extends Error {
  constructor(message, statusCode = 400, campos = null) {
    super(message);
    this.statusCode = statusCode;
    this.campos = campos;
  }
}

module.exports = { AppError };
