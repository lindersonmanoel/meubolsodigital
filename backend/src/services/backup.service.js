"use strict";

const categoriaModel = require("../models/categoria.model");
const categoriaService = require("./categoria.service");
const movimentacaoModel = require("../models/movimentacao.model");
const movimentacaoService = require("./movimentacao.service");
const metaModel = require("../models/meta.model");
const metaService = require("./meta.service");
const orcamentoModel = require("../models/orcamento.model");
const orcamentoService = require("./orcamento.service");
const recorrenciaModel = require("../models/recorrencia.model");
const recorrenciaService = require("./recorrencia.service");
const { paraDataISO } = require("../utils/datas");
const { AppError } = require("../utils/errors");

const VERSAO_BACKUP = 1;

/**
 * Junta tudo que a pessoa tem cadastrado (categorias, movimentacoes, metas, orcamentos,
 * recorrencias) num unico objeto, pra baixar como arquivo e guardar em outro lugar. As
 * categorias sao referenciadas pelo nome (nao pelo id) porque o id so' faz sentido dentro
 * desta conta - ao restaurar (nesta conta ou em outra), o nome e' o que permite religar tudo
 * certo, mesmo que os ids originais nao existam mais.
 */
async function exportarTudo(usuarioId) {
  const [categorias, movimentacoes, metas, orcamentos, recorrencias] = await Promise.all([
    categoriaModel.listar(usuarioId),
    movimentacaoModel.listar(usuarioId, {}),
    metaModel.listar(usuarioId),
    orcamentoModel.listar(usuarioId),
    recorrenciaModel.listar(usuarioId),
  ]);

  return {
    versao: VERSAO_BACKUP,
    app: "Meu Bolso Digital",
    geradoEm: new Date().toISOString(),
    categorias: categorias.map((c) => ({ nome: c.nome, tipo: c.tipo })),
    movimentacoes: movimentacoes.map((m) => ({
      tipo: m.tipo,
      descricao: m.descricao,
      valor: Number(m.valor),
      data: paraDataISO(m.data),
      observacao: m.observacao || undefined,
      categoriaNome: m.categoria_nome || undefined,
    })),
    metas: metas.map((m) => ({
      nome: m.nome,
      valorObjetivo: Number(m.valor_objetivo),
      valorAtual: Number(m.valor_atual),
      prazo: m.prazo ? paraDataISO(m.prazo) : undefined,
      descricao: m.descricao || undefined,
    })),
    orcamentos: orcamentos.map((o) => ({ categoriaNome: o.categoria_nome, valorLimite: Number(o.valor_limite) })),
    recorrencias: recorrencias.map((r) => ({
      tipo: r.tipo,
      descricao: r.descricao,
      valor: Number(r.valor),
      diaMes: r.dia_mes,
      ativa: r.ativa,
      categoriaNome: r.categoria_nome || undefined,
    })),
  };
}

/**
 * Importa um backup gerado por exportarTudo() de volta pra conta da pessoa. NUNCA apaga nada
 * que ja existe - so' adiciona (categorias repetidas, por nome+tipo, sao reaproveitadas em vez
 * de duplicadas). Se restaurar o mesmo backup duas vezes, as movimentacoes/metas/recorrencias
 * ficam duplicadas de proposito (e' "importar", nao "sincronizar") - por isso o aviso na tela
 * antes de restaurar.
 */
async function restaurarTudo(usuarioId, backup) {
  if (!backup || typeof backup !== "object" || !Array.isArray(backup.categorias)) {
    throw new AppError("Esse arquivo não parece ser um backup válido do Meu Bolso Digital.", 422);
  }
  // Confere os outros campos tambem antes de iterar - um arquivo editado/corrompido a mao
  // (ex.: "movimentacoes": {} em vez de uma lista) nao pode virar erro 500.
  const CAMPOS_LISTA = ["movimentacoes", "metas", "orcamentos", "recorrencias"];
  for (const campo of CAMPOS_LISTA) {
    if (backup[campo] != null && !Array.isArray(backup[campo])) {
      throw new AppError(`O campo "${campo}" do backup precisa ser uma lista.`, 422);
    }
  }

  const resultado = {
    categorias: 0,
    movimentacoes: 0,
    metas: 0,
    orcamentos: 0,
    recorrencias: 0,
    avisos: [],
  };

  const categoriasAtuais = await categoriaModel.listar(usuarioId);
  const mapaCategoria = new Map(categoriasAtuais.map((c) => [`${c.nome.toLowerCase()}|${c.tipo}`, c.id]));

  for (const c of backup.categorias || []) {
    const chave = `${String(c.nome || "").toLowerCase()}|${c.tipo}`;
    if (mapaCategoria.has(chave)) continue;
    try {
      const criada = await categoriaService.criar(usuarioId, { nome: c.nome, tipo: c.tipo });
      mapaCategoria.set(chave, criada.id);
      resultado.categorias++;
    } catch (err) {
      resultado.avisos.push(`Categoria "${c.nome}": ${err.message}`);
    }
  }

  function acharCategoriaId(nome, tipo) {
    if (!nome) return undefined;
    return mapaCategoria.get(`${String(nome).toLowerCase()}|${tipo}`);
  }

  for (const m of backup.movimentacoes || []) {
    try {
      await movimentacaoService.criar(
        usuarioId,
        { tipo: m.tipo, descricao: m.descricao, valor: m.valor, data: m.data, observacao: m.observacao, categoriaId: acharCategoriaId(m.categoriaNome, m.tipo) },
        {}
      );
      resultado.movimentacoes++;
    } catch (err) {
      resultado.avisos.push(`Movimentação "${m.descricao}" (${m.data}): ${err.message}`);
    }
  }

  for (const m of backup.metas || []) {
    try {
      await metaService.criar(usuarioId, { nome: m.nome, valorObjetivo: m.valorObjetivo, valorAtual: m.valorAtual, prazo: m.prazo, descricao: m.descricao });
      resultado.metas++;
    } catch (err) {
      resultado.avisos.push(`Meta "${m.nome}": ${err.message}`);
    }
  }

  for (const o of backup.orcamentos || []) {
    const categoriaId = acharCategoriaId(o.categoriaNome, "despesa");
    if (!categoriaId) {
      resultado.avisos.push(`Orçamento "${o.categoriaNome}": categoria não encontrada.`);
      continue;
    }
    try {
      await orcamentoService.criar(usuarioId, { categoriaId, valorLimite: o.valorLimite });
      resultado.orcamentos++;
    } catch (err) {
      // Provavelmente ja existe um orcamento pra essa categoria - nao e' grave, so' pula.
      resultado.avisos.push(`Orçamento "${o.categoriaNome}": ${err.message}`);
    }
  }

  for (const r of backup.recorrencias || []) {
    try {
      await recorrenciaService.criar(usuarioId, {
        tipo: r.tipo, descricao: r.descricao, valor: r.valor, diaMes: r.diaMes, ativa: r.ativa,
        categoriaId: acharCategoriaId(r.categoriaNome, r.tipo),
      });
      resultado.recorrencias++;
    } catch (err) {
      resultado.avisos.push(`Recorrência "${r.descricao}": ${err.message}`);
    }
  }

  return resultado;
}

module.exports = { exportarTudo, restaurarTudo };
