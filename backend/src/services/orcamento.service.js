"use strict";

const orcamentoModel = require("../models/orcamento.model");
const categoriaModel = require("../models/categoria.model");
const { AppError } = require("../utils/errors");
const { VALOR_MAXIMO } = require("../utils/validators");

/** Acrescenta o percentual gasto e um alerta quando passa (ou quase passa) do limite. */
function comAlerta(orcamento) {
  const limite = Number(orcamento.valor_limite);
  const gasto = Number(orcamento.gasto_no_mes);
  const percentual = limite > 0 ? Math.round((gasto / limite) * 1000) / 10 : 0;
  let situacao = "ok";
  if (percentual >= 100) situacao = "estourado";
  else if (percentual >= 80) situacao = "perto_do_limite";
  return { ...orcamento, valor_limite: limite, gasto_no_mes: gasto, percentual, situacao };
}

async function validar(usuarioId, dados, { categoriaFixa } = {}) {
  const erros = {};

  let categoriaId = categoriaFixa;
  if (!categoriaFixa) {
    categoriaId = Number(dados.categoriaId);
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) erros.categoriaId = "Selecione uma categoria.";
  }

  const valorLimite = Number(dados.valorLimite);
  if (!Number.isFinite(valorLimite) || valorLimite <= 0) erros.valorLimite = "Informe um limite maior que zero.";
  else if (valorLimite > VALOR_MAXIMO) erros.valorLimite = "Valor grande demais.";

  if (!erros.categoriaId && categoriaId) {
    const categoria = await categoriaModel.buscarPorId(usuarioId, categoriaId);
    if (!categoria) erros.categoriaId = "Categoria não encontrada.";
    else if (categoria.tipo !== "despesa") erros.categoriaId = "Orçamento só faz sentido pra categorias de despesa.";
  }

  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);
  return { categoriaId, valorLimite };
}

async function listar(usuarioId) {
  const orcamentos = await orcamentoModel.listar(usuarioId);
  return orcamentos.map(comAlerta);
}

async function criar(usuarioId, dados) {
  const validado = await validar(usuarioId, dados);
  const existente = await orcamentoModel.buscarPorCategoria(usuarioId, validado.categoriaId);
  if (existente) throw new AppError("Você já tem um orçamento pra essa categoria.", 409, { categoriaId: "Já existe um orçamento pra essa categoria." });
  const criado = await orcamentoModel.criar(usuarioId, validado);
  return comAlerta(criado);
}

async function atualizar(usuarioId, id, dados) {
  const atual = await orcamentoModel.buscarPorId(usuarioId, id);
  if (!atual) throw new AppError("Orçamento não encontrado.", 404);
  const validado = await validar(usuarioId, dados, { categoriaFixa: atual.categoria_id });
  const atualizado = await orcamentoModel.atualizar(usuarioId, id, validado);
  return comAlerta(atualizado);
}

async function remover(usuarioId, id) {
  const removido = await orcamentoModel.remover(usuarioId, id);
  if (!removido) throw new AppError("Orçamento não encontrado.", 404);
}

module.exports = { listar, criar, atualizar, remover };
