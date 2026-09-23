"use strict";

const authService = require("../services/auth.service");
const userModel = require("../models/user.model");
const { validateRegister, validateLogin, validateEsqueciSenha, normalizeEmail } = require("../utils/validators");

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

async function esqueciSenha(req, res, next) {
  try {
    const { valido, erros, email } = validateEsqueciSenha(req.body || {});
    if (!valido) return res.status(422).json({ erro: "Dados inválidos.", campos: erros });

    await authService.solicitarRecuperacaoSenha(email);
    // Sempre a mesma resposta, exista ou nao o e-mail - ver comentario no auth.service.
    return res.json({ mensagem: "Se esse e-mail estiver cadastrado, você vai receber um link em instantes." });
  } catch (err) {
    return next(err);
  }
}

async function redefinirSenha(req, res, next) {
  try {
    const token = String((req.body || {}).token || "");
    if (!token) return res.status(422).json({ erro: "Dados inválidos.", campos: { token: "Link inválido." } });

    await authService.redefinirSenhaComToken(token, req.body || {});
    return res.json({ mensagem: "Senha redefinida com sucesso." });
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

// Foto aceita como data URL (base64) direto no banco - sem servico de armazenamento externo.
// Limite de tamanho pra nao deixar a tabela pesada: ~700 mil caracteres em base64 da' uma
// imagem de uns 500 KB, de sobra pra um avatar (a pessoa deve mandar ja' pequena/comprimida).
const FOTO_RE = /^data:image\/(png|jpe?g|webp);base64,/;
const FOTO_TAMANHO_MAXIMO = 700000;

async function updateMe(req, res, next) {
  try {
    const nome = String((req.body || {}).nome || "").trim();
    const email = normalizeEmail((req.body || {}).email);
    const erros = {};
    if (nome.length < 2) erros.nome = "Informe seu nome completo.";
    if (!email) erros.email = "O e-mail é obrigatório.";

    const atual = await userModel.findById(req.usuarioId);
    if (!atual) return res.status(404).json({ erro: "Usuário não encontrado." });

    // bio e fotoUrl sao opcionais: so' mexe se a pessoa mandou o campo (senao mantem o que ja
    // estava salvo, pra nao precisar reenviar a foto toda vez que so' o nome muda).
    let bio = atual.bio;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "bio")) {
      bio = String(req.body.bio || "").trim().slice(0, 280) || null;
    }

    let fotoUrl = atual.foto_url;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "fotoUrl")) {
      const valor = req.body.fotoUrl;
      if (!valor) {
        fotoUrl = null;
      } else if (typeof valor !== "string" || !FOTO_RE.test(valor)) {
        erros.fotoUrl = "A foto precisa ser uma imagem (PNG, JPG ou WEBP).";
      } else if (valor.length > FOTO_TAMANHO_MAXIMO) {
        erros.fotoUrl = "A foto está grande demais. Escolha uma imagem menor.";
      } else {
        fotoUrl = valor;
      }
    }

    if (Object.keys(erros).length) return res.status(422).json({ erro: "Dados inválidos.", campos: erros });

    const existente = await userModel.findByEmail(email);
    if (existente && String(existente.id) !== String(req.usuarioId)) {
      return res.status(409).json({ erro: "Já existe uma conta com esse e-mail.", campos: { email: "Já existe uma conta com esse e-mail." } });
    }

    const usuario = await userModel.updateProfile(req.usuarioId, { nome, email, bio, fotoUrl });
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

module.exports = { register, login, logout, me, updateMe, trocarSenha, esqueciSenha, redefinirSenha };
