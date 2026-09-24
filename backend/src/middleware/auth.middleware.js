"use strict";

const authService = require("../services/auth.service");
const userModel = require("../models/user.model");

/** Exige um token valido no cabecalho Authorization: Bearer <token>; preenche req.usuarioId.
 * Alem da assinatura, confere no banco que o usuario ainda existe e que a versao do token
 * (token_version) e' a atual - trocar/redefinir a senha invalida as sessoes antigas. */
async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return next(new authService.AuthError("Token de acesso ausente. Faça login.", 401));
  }
  try {
    const { sub, tv } = authService.decodificarToken(token);
    const versaoAtual = await userModel.tokenVersion(sub);
    // Token sem "tv" (emitido antes desta mudanca) vale como versao 0.
    if (versaoAtual === null || (tv || 0) !== versaoAtual) {
      throw new authService.AuthError("Sessão inválida ou expirada. Faça login novamente.", 401);
    }
    req.usuarioId = sub;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
