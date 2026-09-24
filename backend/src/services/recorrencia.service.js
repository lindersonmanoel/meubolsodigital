"use strict";

const recorrenciaModel = require("../models/recorrencia.model");
const movimentacaoModel = require("../models/movimentacao.model");
const categoriaModel = require("../models/categoria.model");
const { AppError } = require("../utils/errors");
const { partesNoFuso } = require("../utils/fuso");

const TIPOS_VALIDOS = ["receita", "despesa"];

async function validar(usuarioId, dados) {
  const erros = {};
  const tipo = dados.tipo;
  if (!TIPOS_VALIDOS.includes(tipo)) erros.tipo = 'O tipo precisa ser "receita" ou "despesa".';

  const descricao = String(dados.descricao || "").trim();
  if (!descricao) erros.descricao = "Informe uma descrição.";
  else if (descricao.length > 160) erros.descricao = "A descrição pode ter no máximo 160 caracteres.";

  const valor = Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0) erros.valor = "Informe um valor maior que zero.";
  else if (valor > 999999999.99) erros.valor = "Valor grande demais.";

  const diaMes = Number(dados.diaMes);
  if (!Number.isInteger(diaMes) || diaMes < 1 || diaMes > 28) {
    erros.diaMes = "O dia do mês precisa ser um número entre 1 e 28 (evita problemas em meses curtos).";
  }

  let categoriaId = null;
  if (dados.categoriaId != null && dados.categoriaId !== "") {
    categoriaId = Number(dados.categoriaId);
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
      erros.categoriaId = "Categoria inválida.";
    } else {
      const categoria = await categoriaModel.buscarPorId(usuarioId, categoriaId);
      if (!categoria) erros.categoriaId = "Categoria não encontrada.";
      else if (categoria.tipo !== tipo) erros.categoriaId = `Essa categoria é de ${categoria.tipo}, não de ${tipo}.`;
    }
  }

  const ativa = dados.ativa !== false;

  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);
  return { tipo, descricao, valor, diaMes, categoriaId, ativa };
}

async function listar(usuarioId) {
  return recorrenciaModel.listar(usuarioId);
}

async function criar(usuarioId, dados) {
  const validado = await validar(usuarioId, dados);
  return recorrenciaModel.criar(usuarioId, validado);
}

async function atualizar(usuarioId, id, dados) {
  const validado = await validar(usuarioId, dados);
  const atualizada = await recorrenciaModel.atualizar(usuarioId, id, validado);
  if (!atualizada) throw new AppError("Recorrência não encontrada.", 404);
  return atualizada;
}

async function remover(usuarioId, id) {
  const removida = await recorrenciaModel.remover(usuarioId, id);
  if (!removida) throw new AppError("Recorrência não encontrada.", 404);
}

/**
 * Gera a movimentacao do mes atual pra cada recorrencia ativa que ainda nao tem uma (secao
 * de melhorias: receitas/despesas fixas). Chamado sempre que a pessoa abre o dashboard ou a
 * lista de movimentacoes - nao precisa de agendador/cron separado, so' "preenche a lacuna" na
 * primeira vez que alguem olha o app depois da virada do mes.
 */
async function gerarDoMesAtual(usuarioId, agora = new Date()) {
  const ativas = await recorrenciaModel.listarAtivas(usuarioId);
  if (!ativas.length) return [];

  // Mes/dia no fuso do app (America/Sao_Paulo), nao no do servidor (UTC).
  const { ano, mes, dia: diaHoje } = partesNoFuso(agora);
  const anoMes = `${ano}-${String(mes).padStart(2, "0")}`;

  const geradas = [];
  for (const recorrencia of ativas) {
    if (recorrencia.dia_mes > diaHoje) continue; // ainda nao chegou o dia neste mes
    const jaExiste = await movimentacaoModel.existeGeradaNoMes(usuarioId, recorrencia.id, anoMes);
    if (jaExiste) continue;
    const data = `${anoMes}-${String(recorrencia.dia_mes).padStart(2, "0")}`;
    const movimentacao = await movimentacaoModel.criarDeRecorrencia(usuarioId, {
      recorrenciaId: recorrencia.id,
      categoriaId: recorrencia.categoria_id,
      tipo: recorrencia.tipo,
      descricao: recorrencia.descricao,
      valor: recorrencia.valor,
      data,
    });
    // null = outra requisicao gerou a mesma recorrencia/mes ao mesmo tempo (indice unico): nada a fazer.
    if (movimentacao) geradas.push(movimentacao);
  }
  return geradas;
}

module.exports = { listar, criar, atualizar, remover, gerarDoMesAtual };
