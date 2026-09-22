"use strict";

const { AppError } = require("../utils/errors");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { erro: err.message };
    if (err.campos) body.campos = err.campos;
    return res.status(err.statusCode).json(body);
  }
  if (err && err.message === "Origem não permitida pelo CORS.") {
    return res.status(403).json({ erro: err.message });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ erro: "Corpo da requisição muito grande." });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "JSON inválido no corpo da requisição." });
  }
  // Erro não mapeado: nunca vaza detalhe interno (consulta SQL, stack trace) para o cliente.
  // eslint-disable-next-line no-console
  console.error("[erro não tratado]", err);
  return res.status(500).json({ erro: "Erro interno. Tente novamente em instantes." });
}

module.exports = errorHandler;
