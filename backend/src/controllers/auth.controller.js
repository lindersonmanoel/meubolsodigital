"use strict";

const authService = require("../services/auth.service");
const userModel = require("../models/user.model");
const { validateRegister, validateLogin, normalizeEmail } = require("../utils/validators");

async function register(req, res, next) {
  try {
    const { valido, erros, nome, email } = validateRegister(req.body || {});
    if (!valido) return res.status(422).json({ erro: "Dados inválidos.", campos: erros });

    const usuario = await authService.registrar({ nome, email, senha: req.body.senha });
    return res.status(201).json({
      mensagem: "Conta criada com sucesso. Faça login para continuar.",
      usuario,
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { valido, erros, email } = validateLogin(req.body || {});
    if (!valido) return res.status(422).json({ erro: "Dados inválidos.", campos: erros });

    const { usuario, token } = await authService.autenticar({ email, senha: req.body.senha });
    return res.json({ usuario, token });
  } catch (err) {
    return next(err);
  }
}

function logout(_req, res) {
  // Token JWT sem estado: não há sessão no servidor para invalidar aqui.
  // O front descarta o token guardado; se um dia precisar de revogação antes do
  // vencimento (ex.: "sair de todos os dispositivos"), isso exige uma lista de
  // tokens revogados no banco, propositalmente fora do escopo desta fase.
  return res.json({ mensagem: "Sessão encerrada." });
}

async function me(req, res, next) {
  try {
    const usuario = await userModel.findById(req.usuarioId);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ usuario });
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const nome = String((req.body || {}).nome || "").trim();
    const email = normalizeEmail((req.body || {}).email);
    const erros = {};
    if (nome.length < 2) erros.nome = "Informe seu nome completo.";
    if (!email) erros.email = "O e-mail é obrigatório.";
    if (Object.keys(erros).length) return res.status(422).json({ erro: "Dados inválidos.", campos: erros });

    const existente = await userModel.findByEmail(email);
    if (existente && String(existente.id) !== String(req.usuarioId)) {
      return res.status(409).json({ erro: "Já existe uma conta com esse e-mail.", campos: { email: "Já existe uma conta com esse e-mail." } });
    }

    const usuario = await userModel.updateProfile(req.usuarioId, { nome, email });
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ usuario });
  } catch (err) {
    return next(err);
  }
}

async function trocarSenha(req, res, next) {
  try {
    await authService.trocarSenha(req.usuarioId, req.body || {});
    return res.json({ mensagem: "Senha atualizada com sucesso." });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, logout, me, updateMe, trocarSenha };
