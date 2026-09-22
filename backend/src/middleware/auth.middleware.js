"use strict";

const authService = require("../services/auth.service");

/** Exige um token valido no cabecalho Authorization: Bearer <token>; preenche req.usuarioId. */
function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return next(new authService.AuthError("Token de acesso ausente. Faça login.", 401));
  }
  try {
    req.usuarioId = authService.verificarToken(token);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
