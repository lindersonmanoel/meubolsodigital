"use strict";

// Nao aceita espaco, @ nem caracteres que abrem marcacao HTML ou aspas (< > " ' `): um e-mail
// assim nunca e' legitimo e, se chegasse a tela sem escape, viraria XSS.
const EMAIL_RE = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/;

// Maior valor que cabe em NUMERIC(12,2) (usado em movimentacoes, recorrencias, metas e orcamentos).
const VALOR_MAXIMO = 999999999.99;
const NOME_MAX = 120;
const EMAIL_MAX = 160;

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

/** Nome e e-mail do perfil (mesmas regras do cadastro). Devolve so' os erros encontrados. */
function validateNomeEmail(nome, email) {
  const erros = {};
  if (nome.length < 2) erros.nome = "Informe seu nome completo.";
  else if (nome.length > NOME_MAX) erros.nome = `O nome pode ter no máximo ${NOME_MAX} caracteres.`;
  if (!email) erros.email = "O e-mail é obrigatório.";
  else if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) erros.email = "Informe um e-mail válido.";
  return erros;
}

module.exports = {
  normalizeEmail, validateRegister, validateLogin, validateEsqueciSenha, validateNomeEmail,
  EMAIL_RE, VALOR_MAXIMO,
};
