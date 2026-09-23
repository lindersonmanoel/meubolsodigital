"use strict";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateRegister({ nome, email, senha, confirmarSenha }) {
  const erros = {};
  const nomeLimpo = String(nome || "").trim();
  if (nomeLimpo.length < 2) erros.nome = "Informe seu nome completo.";
  else if (nomeLimpo.length > 120) erros.nome = "O nome pode ter no máximo 120 caracteres.";

  const emailLimpo = normalizeEmail(email);
  if (!emailLimpo) erros.email = "O e-mail é obrigatório.";
  else if (emailLimpo.length > 160 || !EMAIL_RE.test(emailLimpo)) erros.email = "Informe um e-mail válido.";

  const senhaStr = String(senha || "");
  if (senhaStr.length < 8) erros.senha = "A senha precisa ter pelo menos 8 caracteres.";
  else if (senhaStr.length > 200) erros.senha = "Senha muito longa.";

  if (senha !== confirmarSenha) erros.confirmarSenha = "As senhas não coincidem.";

  return { valido: Object.keys(erros).length === 0, erros, nome: nomeLimpo, email: emailLimpo };
}

function validateLogin({ email, senha }) {
  const erros = {};
  const emailLimpo = normalizeEmail(email);
  if (!emailLimpo) erros.email = "Informe o e-mail.";
  if (!senha) erros.senha = "Informe a senha.";
  return { valido: Object.keys(erros).length === 0, erros, email: emailLimpo };
}

function validateEsqueciSenha({ email }) {
  const erros = {};
  const emailLimpo = normalizeEmail(email);
  if (!emailLimpo || !EMAIL_RE.test(emailLimpo)) erros.email = "Informe um e-mail válido.";
  return { valido: Object.keys(erros).length === 0, erros, email: emailLimpo };
}

module.exports = { normalizeEmail, validateRegister, validateLogin, validateEsqueciSenha, EMAIL_RE };
