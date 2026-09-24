"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const userModel = require("../models/user.model");
const categoriaModel = require("../models/categoria.model");
const { CATEGORIAS_PADRAO } = require("../utils/categoriasPadrao");
const passwordResetModel = require("../models/passwordReset.model");
const emailService = require("./email.service");
const { AppError } = require("../utils/errors");

// Em teste o custo minimo do bcrypt (4) deixa a suite bem mais rapida; producao segue com 12.
const SALT_ROUNDS = config.isTest ? 4 : 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class AuthError extends AppError {
  constructor(message, statusCode = 400, campo = null) {
    super(message, statusCode, campo ? { [campo]: message } : null);
    this.campo = campo;
  }
}

// Algoritmo fixado na assinatura E na verificacao (nao aceita o que o cabecalho do token disser).
const JWT_ALGORITMO = "HS256";

// Hash de uma senha qualquer: o login compara contra ele quando o e-mail nao existe, pra gastar o
// mesmo tempo de bcrypt e nao revelar (pelo tempo de resposta) quais e-mails tem conta.
const HASH_FALSO = bcrypt.hashSync("senha-que-nao-pertence-a-ninguem", SALT_ROUNDS);

/** tokenVersion: versao do token do usuario; trocar a senha incrementa e invalida os tokens antigos. */
function assinarToken(usuario, tokenVersion = 0) {
  return jwt.sign({ sub: String(usuario.id), tv: tokenVersion }, config.jwtSecret, {
    algorithm: JWT_ALGORITMO,
    expiresIn: config.jwtExpiresIn,
  });
}

async function registrar({ nome, email, senha }) {
  const existente = await userModel.findByEmail(email);
  if (existente) throw new AuthError("Já existe uma conta com esse e-mail.", 409, "email");

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const usuario = await userModel.create({ nome, email, senhaHash });
  if (config.categoriasPadrao) await categoriaModel.criarVarias(usuario.id, CATEGORIAS_PADRAO);
  return usuario;
}

async function autenticar({ email, senha }) {
  // Mensagem generica de proposito (nao revela se o e-mail existe ou nao) - evita
  // que alguem descubra quais e-mails estao cadastrados so tentando login.
  const credenciaisInvalidas = () => new AuthError("E-mail ou senha inválidos.", 401);

  const registro = await userModel.findByEmail(email);

  // Sempre roda o bcrypt (contra um hash falso se a conta nao existe): tempo de resposta igual.
  const confere = await bcrypt.compare(senha, registro ? registro.senha_hash : HASH_FALSO);
  if (!registro || !confere) throw credenciaisInvalidas();

  const usuario = { id: registro.id, nome: registro.nome, email: registro.email };
  const token = assinarToken(usuario, registro.token_version);
  return { usuario, token };
}

async function trocarSenha(usuarioId, { senhaAtual, novaSenha, confirmarNovaSenha }) {
  const erros = {};
  if (String(novaSenha || "").length < 8) erros.novaSenha = "A nova senha precisa ter pelo menos 8 caracteres.";
  if (novaSenha !== confirmarNovaSenha) erros.confirmarNovaSenha = "As senhas não coincidem.";
  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);

  const registro = await userModel.findById(usuarioId, { comSenha: true });
  if (!registro) throw new AuthError("Usuário não encontrado.", 404);
  const confere = await bcrypt.compare(senhaAtual || "", registro.senha_hash);
  if (!confere) throw new AppError("Senha atual incorreta.", 401, { senhaAtual: "Senha atual incorreta." });

  const senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
  const novaVersao = await userModel.updateSenhaHash(usuarioId, senhaHash);
  // Os tokens antigos (inclusive o desta sessao) deixaram de valer: devolve um novo pra sessao atual.
  return { token: assinarToken({ id: usuarioId }, novaVersao) };
}

async function solicitarRecuperacaoSenha(email) {
  const usuario = await userModel.findByEmail(email);
  // Mensagem de resposta e' sempre a mesma exista ou nao o e-mail (o controller cuida
  // disso) - ao contrario do cadastro, aqui nao ha' necessidade nenhuma de diferenciar:
  // a pessoa so' olha o proprio e-mail depois, entao dar silenciosamente errado quando
  // a conta nao existe fecha por completo a enumeracao nesta rota.
  if (!usuario) return;

  await passwordResetModel.invalidarPendentes(usuario.id);

  const token = crypto.randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await passwordResetModel.criar({ usuarioId: usuario.id, tokenHash: hashToken(token), expiraEm });

  const link = `${config.frontendUrl}/redefinir-senha.html?token=${token}`;
  // Nao espera o envio terminar: o tempo de resposta nao pode diferenciar conta existente de
  // inexistente (a chamada do e-mail e' lenta). A falha, se houver, e' registrada no log.
  Promise.resolve(emailService.enviarRecuperacaoSenha({ para: usuario.email, nome: usuario.nome, link })).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[email] erro inesperado ao enviar recuperação:", err && err.message);
  });
}

async function redefinirSenhaComToken(token, { novaSenha, confirmarNovaSenha }) {
  const erros = {};
  if (String(novaSenha || "").length < 8) erros.novaSenha = "A nova senha precisa ter pelo menos 8 caracteres.";
  if (novaSenha !== confirmarNovaSenha) erros.confirmarNovaSenha = "As senhas não coincidem.";
  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);

  const registro = await passwordResetModel.buscarValidoPorHash(hashToken(token));
  if (!registro) throw new AuthError("Link inválido ou expirado. Peça uma nova recuperação de senha.", 400);

  const senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
  await userModel.updateSenhaHash(registro.usuario_id, senhaHash);
  await passwordResetModel.marcarUsado(registro.id);
}

/** Le e valida a assinatura/validade do token. Devolve o payload ({ sub, tv, ... }). */
function decodificarToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITMO] });
  } catch (err) {
    throw new AuthError("Sessão inválida ou expirada. Faça login novamente.", 401);
  }
}

function verificarToken(token) {
  return decodificarToken(token).sub;
}

module.exports = {
  AuthError,
  registrar,
  autenticar,
  verificarToken,
  decodificarToken,
  assinarToken,
  trocarSenha,
  solicitarRecuperacaoSenha,
  redefinirSenhaComToken,
};
