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

// O bcrypt so' considera os primeiros 72 bytes da senha: aceitar mais que isso daria falsa seguranca.
const SENHA_MIN = 8;
const SENHA_MAX_BYTES = 72;
const SENHAS_COMUNS = new Set([
  "12345678", "123456789", "1234567890", "12341234", "11111111", "00000000", "87654321", "password",
  "password1", "senha123", "senha1234", "senhasenha", "qwertyui", "qwerty123", "abc12345", "iloveyou",
  "admin123", "brasil123", "mudar123", "123mudar", "minhasenha",
]);

/** Regras da senha nova (cadastro, troca e redefinicao). Devolve a mensagem de erro ou null. */
function validarSenhaNova(senha) {
  const texto = String(senha || "");
  if (texto.length < SENHA_MIN) return "A senha precisa ter pelo menos 8 caracteres.";
  if (Buffer.byteLength(texto, "utf8") > SENHA_MAX_BYTES) {
    return "A senha pode ter no máximo 72 bytes (cerca de 72 caracteres; acentos e emojis ocupam mais).";
  }
  if (SENHAS_COMUNS.has(texto.toLowerCase())) return "Essa senha é muito comum. Escolha outra.";
  return null;
}

function validateRegister({ nome, email, senha, confirmarSenha }) {
  const erros = {};
  const nomeLimpo = String(nome || "").trim();
  if (nomeLimpo.length < 2) erros.nome = "Informe seu nome completo.";
  else if (nomeLimpo.length > 120) erros.nome = "O nome pode ter no máximo 120 caracteres.";

  const emailLimpo = normalizeEmail(email);
  if (!emailLimpo) erros.email = "O e-mail é obrigatório.";
  else if (emailLimpo.length > 160 || !EMAIL_RE.test(emailLimpo)) erros.email = "Informe um e-mail válido.";

  const erroSenha = validarSenhaNova(senha);
  if (erroSenha) erros.senha = erroSenha;

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
  validarSenhaNova, EMAIL_RE, VALOR_MAXIMO,
};
