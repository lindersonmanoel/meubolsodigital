"use strict";

const categoriaModel = require("../models/categoria.model");
const { AppError } = require("../utils/errors");

const TIPOS_VALIDOS = ["receita", "despesa"];

function validar({ nome, tipo }) {
  const erros = {};
  const nomeLimpo = String(nome || "").trim();
  if (nomeLimpo.length < 2) erros.nome = "Informe um nome com pelo menos 2 caracteres.";
  else if (nomeLimpo.length > 80) erros.nome = "O nome pode ter no máximo 80 caracteres.";
  if (!TIPOS_VALIDOS.includes(tipo)) erros.tipo = 'O tipo precisa ser "receita" ou "despesa".';
  return { erros, nome: nomeLimpo, tipo };
}

async function listar(usuarioId) {
  return categoriaModel.listar(usuarioId);
}

async function criar(usuarioId, dados) {
  const { erros, nome, tipo } = validar(dados);
  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);
  if (await categoriaModel.existeComNome(usuarioId, nome, tipo)) {
    throw new AppError("Você já tem uma categoria com esse nome para esse tipo.", 409, {
      nome: "Você já tem uma categoria com esse nome para esse tipo.",
    });
  }
  return categoriaModel.criar(usuarioId, { nome, tipo });
}

async function atualizar(usuarioId, id, dados) {
  const { erros, nome, tipo } = validar(dados);
  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);

  const atual = await categoriaModel.buscarPorId(usuarioId, id);
  if (!atual) throw new AppError("Categoria não encontrada.", 404);

  if (atual.tipo !== tipo && (await categoriaModel.emUso(usuarioId, id))) {
    throw new AppError(
      "Essa categoria já tem movimentações, recorrências ou um orçamento ligados a ela - não dá pra trocar entre receita e despesa. Crie uma categoria nova se precisar do outro tipo.",
      409,
      { tipo: "Não dá pra trocar o tipo de uma categoria já em uso." }
    );
  }

  if (await categoriaModel.existeComNome(usuarioId, nome, tipo, id)) {
    throw new AppError("Você já tem uma categoria com esse nome para esse tipo.", 409, {
      nome: "Você já tem uma categoria com esse nome para esse tipo.",
    });
  }
  const categoria = await categoriaModel.atualizar(usuarioId, id, { nome, tipo });
  if (!categoria) throw new AppError("Categoria não encontrada.", 404);
  return categoria;
}

async function remover(usuarioId, id) {
  const removida = await categoriaModel.remover(usuarioId, id);
  if (!removida) throw new AppError("Categoria não encontrada.", 404);
}

module.exports = { listar, criar, atualizar, remover, TIPOS_VALIDOS };
