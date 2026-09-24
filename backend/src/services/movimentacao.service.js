"use strict";

const movimentacaoModel = require("../models/movimentacao.model");
const categoriaModel = require("../models/categoria.model");
const { AppError } = require("../utils/errors");

const TIPOS_VALIDOS = ["receita", "despesa"];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function validarData(valor, campo, erros) {
  if (!valor || !DATA_RE.test(valor) || Number.isNaN(Date.parse(valor))) {
    erros[campo] = "Informe uma data válida (AAAA-MM-DD).";
    return null;
  }
  return valor;
}

async function validar(usuarioId, dados, { tipoFixo } = {}) {
  const erros = {};
  const tipo = tipoFixo || dados.tipo;
  if (!TIPOS_VALIDOS.includes(tipo)) erros.tipo = 'O tipo precisa ser "receita" ou "despesa".';

  const descricao = String(dados.descricao || "").trim();
  if (!descricao) erros.descricao = "Informe uma descrição.";
  else if (descricao.length > 160) erros.descricao = "A descrição pode ter no máximo 160 caracteres.";

  const valor = Number(dados.valor);
  if (!Number.isFinite(valor) || valor <= 0) erros.valor = "Informe um valor maior que zero.";
  else if (valor > 999999999.99) erros.valor = "Valor grande demais.";

  const data = validarData(dados.data, "data", erros);

  const observacao = dados.observacao == null ? null : String(dados.observacao).trim().slice(0, 2000) || null;

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

  if (Object.keys(erros).length) throw new AppError("Dados inválidos.", 422, erros);
  return { tipo, descricao, valor, data, observacao, categoriaId };
}

function normalizarFiltros(query, { tipoFixo } = {}) {
  const filtros = {};
  if (tipoFixo) filtros.tipo = tipoFixo;
  else if (query.tipo && TIPOS_VALIDOS.includes(query.tipo)) filtros.tipo = query.tipo;
  if (query.categoriaId) {
    const id = Number(query.categoriaId);
    if (Number.isInteger(id) && id > 0) filtros.categoriaId = id;
  }
  if (query.inicio && DATA_RE.test(query.inicio)) filtros.inicio = query.inicio;
  if (query.fim && DATA_RE.test(query.fim)) filtros.fim = query.fim;
  if (query.busca) filtros.busca = String(query.busca).trim().slice(0, 160);
  if (query.valorMin != null && query.valorMin !== "") {
    const v = Number(query.valorMin);
    if (Number.isFinite(v)) filtros.valorMin = v;
  }
  if (query.valorMax != null && query.valorMax !== "") {
    const v = Number(query.valorMax);
    if (Number.isFinite(v)) filtros.valorMax = v;
  }
  return filtros;
}

async function listar(usuarioId, query, opts) {
  return movimentacaoModel.listar(usuarioId, normalizarFiltros(query, opts));
}

const LIMITE_MAXIMO = 200;

/** So' pagina se a chamada trouxer "limite" - exportacoes e telas antigas seguem recebendo tudo. */
function normalizarPaginacao(query) {
  const limite = Number.parseInt(query.limite, 10);
  if (!Number.isInteger(limite) || limite < 1) return null;
  const tamanho = Math.min(limite, LIMITE_MAXIMO);
  const pagina = Math.max(1, Number.parseInt(query.pagina, 10) || 1);
  return { pagina, limite: tamanho, offset: (pagina - 1) * tamanho };
}

async function listarPaginado(usuarioId, query, opts) {
  const paginacao = normalizarPaginacao(query);
  if (!paginacao) return { itens: await listar(usuarioId, query, opts), paginacao: null };
  const filtros = normalizarFiltros(query, opts);
  const [itens, total] = await Promise.all([
    movimentacaoModel.listar(usuarioId, filtros, paginacao),
    movimentacaoModel.contar(usuarioId, filtros),
  ]);
  return {
    itens,
    paginacao: {
      pagina: paginacao.pagina,
      limite: paginacao.limite,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / paginacao.limite)),
    },
  };
}

async function criar(usuarioId, dados, opts) {
  const validado = await validar(usuarioId, dados, opts);
  return movimentacaoModel.criar(usuarioId, validado);
}

async function atualizar(usuarioId, id, dados, opts) {
  const validado = await validar(usuarioId, dados, opts);
  const atualizada = await movimentacaoModel.atualizar(usuarioId, id, validado);
  if (!atualizada) throw new AppError("Movimentação não encontrada.", 404);
  return atualizada;
}

async function remover(usuarioId, id) {
  const removida = await movimentacaoModel.remover(usuarioId, id);
  if (!removida) throw new AppError("Movimentação não encontrada.", 404);
}

module.exports = { listar, listarPaginado, criar, atualizar, remover, TIPOS_VALIDOS };
