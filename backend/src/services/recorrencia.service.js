"use strict";

const recorrenciaModel = require("../models/recorrencia.model");
const movimentacaoModel = require("../models/movimentacao.model");
const categoriaModel = require("../models/categoria.model");
const { AppError } = require("../utils/errors");
const { partesNoFuso } = require("../utils/fuso");
const { paraDataISO } = require("../utils/datas");

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

// Ate' quantos meses pra tras uma recorrencia e' preenchida de uma vez (evita despejar anos de lancamentos).
const MAX_MESES_RETROATIVOS = 12;

const indiceDoMes = (ano, mes) => ano * 12 + (mes - 1); // mes 1-12
const anoMesDoIndice = (indice) => ({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 });
const doisDigitos = (n) => String(n).padStart(2, "0");

/**
 * Gera as movimentacoes das recorrencias ativas. Chamado sempre que a pessoa abre o dashboard - nao
 * precisa de agendador/cron: "preenche a lacuna" quando alguem olha o app.
 *
 * Cada recorrencia guarda ultimo_mes_gerado (ate' que mes ja' foi processada). A geracao cobre os meses
 * DEPOIS dele ate' o atual (max. 12), entao:
 *  - meses em que a pessoa nao abriu o app sao preenchidos;
 *  - um lancamento apagado de proposito NAO volta (o mes ja' consta como processado);
 *  - recorrencia sem historico parte do mes em que foi criada.
 * No mes atual, so' gera se o dia da recorrencia ja' chegou. Duplicidade e' barrada pelo indice unico.
 */
async function gerarDoMesAtual(usuarioId, agora = new Date()) {
  const ativas = await recorrenciaModel.listarAtivas(usuarioId);
  if (!ativas.length) return [];

  // Mes/dia no fuso do app (America/Sao_Paulo), nao no do servidor (UTC).
  const { ano, mes, dia: diaHoje } = partesNoFuso(agora);
  const atual = indiceDoMes(ano, mes);

  const geradas = [];
  for (const recorrencia of ativas) {
    let inicio;
    if (recorrencia.ultimo_mes_gerado) {
      const [a, m] = paraDataISO(recorrencia.ultimo_mes_gerado).split("-").map(Number);
      inicio = indiceDoMes(a, m) + 1;
    } else {
      const criada = partesNoFuso(new Date(recorrencia.criado_em));
      inicio = indiceDoMes(criada.ano, criada.mes);
    }

    let processouAlgum = false;
    for (let indice = Math.max(inicio, atual - (MAX_MESES_RETROATIVOS - 1)); indice <= atual; indice += 1) {
      if (indice === atual && recorrencia.dia_mes > diaHoje) break; // ainda nao chegou o dia neste mes
      const { ano: a, mes: m } = anoMesDoIndice(indice);
      const anoMes = `${a}-${doisDigitos(m)}`;
      processouAlgum = true;

      const jaExiste = await movimentacaoModel.existeGeradaNoMes(usuarioId, recorrencia.id, anoMes);
      if (jaExiste) continue;
      const movimentacao = await movimentacaoModel.criarDeRecorrencia(usuarioId, {
        recorrenciaId: recorrencia.id,
        categoriaId: recorrencia.categoria_id,
        tipo: recorrencia.tipo,
        descricao: recorrencia.descricao,
        valor: recorrencia.valor,
        data: `${anoMes}-${doisDigitos(recorrencia.dia_mes)}`,
      });
      // null = outra requisicao gerou a mesma recorrencia/mes ao mesmo tempo (indice unico): nada a fazer.
      if (movimentacao) geradas.push(movimentacao);
    }

    if (processouAlgum) {
      // Marca ate' o ultimo mes efetivamente processado (o atual, se o dia ja' chegou; senao o anterior).
      const ultimo = recorrencia.dia_mes > diaHoje ? atual - 1 : atual;
      const { ano: a, mes: m } = anoMesDoIndice(ultimo);
      await recorrenciaModel.marcarUltimoMes(recorrencia.id, `${a}-${doisDigitos(m)}-01`);
    }
  }
  return geradas;
}

module.exports = { listar, criar, atualizar, remover, gerarDoMesAtual };
