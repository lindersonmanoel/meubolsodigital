"use strict";

const metaModel = require("../models/meta.model");
const { AppError } = require("../utils/errors");

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** progresso = valor_atual / valor_objetivo * 100, nunca passando de 100 (secao 27). */
function comProgresso(meta) {
  const objetivo = Number(meta.valor_objetivo);
  const atual = Number(meta.valor_atual);
  const progresso = objetivo > 0 ? Math.min(100, Math.round((atual / objetivo) * 1000) / 10) : 0;
  return { ...meta, valor_objetivo: objetivo, valor_atual: atual, progresso };
}

function validar(dados) {
  const erros = {};
  const nome = String(dados.nome || "").trim();
  if (nome.length < 2) erros.nome = "Informe um nome com pelo menos 2 caracteres.";
  else if (nome.length > 120) erros.nome = "O nome pode ter no máximo 120 caracteres.";

  const valorObjetivo = Number(dados.valorObjetivo);
  if (!Number.isFinite(valorObjetivo) || valorObjetivo <= 0) erros.valorObjetivo = "Informe um objetivo maior que zero.";

  let valorAtual = dados.valorAtual == null || dados.valorAtual === "" ? 0 : Number(dados.valorAtual);
  if (!Number.isFinite(valorAtual) || valorAtual < 0) erros.valorAtual = "O valor atual não pode ser negativo.";

  let prazo = null;
  if (dados.prazo) {
    if (!DATA_RE.test(dados.prazo) || Number.isNaN(Date.parse(dados.prazo))) erros.prazo = "Informe um prazo válido (AAAA-MM-DD).";
    else prazo = dados.prazo;
  }

  const descricao = dados.descricao == null ? null : String(dados.descricao).trim().slice(0, 2000) || null;

  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);
  return { nome, valorObjetivo, valorAtual, prazo, descricao };
}

async function listar(usuarioId) {
  const metas = await metaModel.listar(usuarioId);
  return metas.map(comProgresso);
}

async function criar(usuarioId, dados) {
  const validado = validar(dados);
  const meta = await metaModel.criar(usuarioId, validado);
  return comProgresso(meta);
}

async function atualizar(usuarioId, id, dados) {
  const validado = validar(dados);
  const meta = await metaModel.atualizar(usuarioId, id, validado);
  if (!meta) throw new AppError("Meta não encontrada.", 404);
  return comProgresso(meta);
}

async function remover(usuarioId, id) {
  const removida = await metaModel.remover(usuarioId, id);
  if (!removida) throw new AppError("Meta não encontrada.", 404);
}

module.exports = { listar, criar, atualizar, remover, comProgresso };
