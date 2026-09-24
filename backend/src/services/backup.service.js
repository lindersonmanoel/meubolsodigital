"use strict";

const pool = require("../database/pool");
const categoriaModel = require("../models/categoria.model");
const movimentacaoModel = require("../models/movimentacao.model");
const metaModel = require("../models/meta.model");
const orcamentoModel = require("../models/orcamento.model");
const recorrenciaModel = require("../models/recorrencia.model");
const { paraDataISO, dataValida } = require("../utils/datas");
const { VALOR_MAXIMO } = require("../utils/validators");
const { AppError } = require("../utils/errors");

const VERSAO_BACKUP = 1;
const TIPOS_VALIDOS = ["receita", "despesa"];
const TAMANHO_LOTE = 1000; // linhas por INSERT em lote
const MAX_ITENS_POR_LISTA = 100000;
const MAX_AVISOS = 50; // a resposta nao pode virar um arquivo gigante se o backup estiver muito sujo

/**
 * Junta tudo que a pessoa tem cadastrado (categorias, movimentacoes, metas, orcamentos,
 * recorrencias) num unico objeto, pra baixar como arquivo e guardar em outro lugar. As
 * categorias sao referenciadas pelo nome (nao pelo id) porque o id so' faz sentido dentro
 * desta conta - ao restaurar (nesta conta ou em outra), o nome e' o que permite religar tudo
 * certo, mesmo que os ids originais nao existam mais. As movimentacoes geradas por uma
 * recorrencia guardam "recorrenciaIndice" (posicao dela na lista "recorrencias"), pra o vinculo
 * sobreviver a restauracao.
 */
async function exportarTudo(usuarioId) {
  const [categorias, movimentacoes, metas, orcamentos, recorrencias] = await Promise.all([
    categoriaModel.listar(usuarioId),
    movimentacaoModel.listar(usuarioId, {}),
    metaModel.listar(usuarioId),
    orcamentoModel.listar(usuarioId),
    recorrenciaModel.listar(usuarioId),
  ]);
  const indicePorRecorrencia = new Map(recorrencias.map((r, i) => [String(r.id), i]));

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
      recorrenciaIndice: m.recorrencia_id != null ? indicePorRecorrencia.get(String(m.recorrencia_id)) : undefined,
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

// ------------------------------------------------------------------ validacao (pura, sem banco)

const texto = (v) => String(v == null ? "" : v).trim();

function valorPositivo(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= VALOR_MAXIMO ? Math.round(n * 100) / 100 : null;
}

const chaveCategoria = (nome, tipo) => `${texto(nome).toLowerCase()}|${tipo}`;

/**
 * Importa um backup gerado por exportarTudo() de volta pra conta da pessoa. NUNCA apaga nada que
 * ja existe - so' adiciona (categorias repetidas, por nome+tipo, sao reaproveitadas em vez de
 * duplicadas). Se restaurar o mesmo backup duas vezes, as movimentacoes/metas/recorrencias ficam
 * duplicadas de proposito (e' "importar", nao "sincronizar") - por isso o aviso na tela antes.
 *
 * Tudo acontece numa UNICA TRANSACAO: ou entra tudo o que era valido, ou nada (uma falha no meio
 * nao deixa a conta com metade do backup). Itens invalidos sao pulados e listados em "avisos".
 * As insercoes sao em lote (milhares de movimentacoes em poucos segundos).
 */
async function restaurarTudo(usuarioId, backup) {
  if (!backup || typeof backup !== "object" || !Array.isArray(backup.categorias)) {
    throw new AppError("Esse arquivo não parece ser um backup válido do Meu Bolso Digital.", 422);
  }
  // Confere os outros campos tambem antes de iterar - um arquivo editado/corrompido a mao
  // (ex.: "movimentacoes": {} em vez de uma lista) nao pode virar erro 500.
  const CAMPOS_LISTA = ["categorias", "movimentacoes", "metas", "orcamentos", "recorrencias"];
  for (const campo of CAMPOS_LISTA) {
    if (backup[campo] != null && !Array.isArray(backup[campo])) {
      throw new AppError(`O campo "${campo}" do backup precisa ser uma lista.`, 422);
    }
    if (Array.isArray(backup[campo]) && backup[campo].length > MAX_ITENS_POR_LISTA) {
      throw new AppError(`O campo "${campo}" tem itens demais (máximo ${MAX_ITENS_POR_LISTA}).`, 422);
    }
  }

  const resultado = { categorias: 0, movimentacoes: 0, metas: 0, orcamentos: 0, recorrencias: 0, avisos: [] };
  let avisosOmitidos = 0;
  const aviso = (mensagem) => {
    if (resultado.avisos.length < MAX_AVISOS) resultado.avisos.push(mensagem);
    else avisosOmitidos += 1;
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ---- categorias (reaproveita as existentes pelo nome+tipo, sem diferenciar maiusculas)
    const { rows: atuais } = await client.query("SELECT id, nome, tipo FROM categorias WHERE usuario_id = $1", [usuarioId]);
    const mapaCategoria = new Map(atuais.map((c) => [chaveCategoria(c.nome, c.tipo), c.id]));
    const novasCategorias = new Map(); // chave -> { nome, tipo }
    for (const c of backup.categorias || []) {
      const nome = texto(c && c.nome);
      const tipo = c && c.tipo;
      if (nome.length < 2 || nome.length > 80 || !TIPOS_VALIDOS.includes(tipo)) {
        aviso(`Categoria "${nome}": dados inválidos.`);
        continue;
      }
      const chave = chaveCategoria(nome, tipo);
      if (!mapaCategoria.has(chave) && !novasCategorias.has(chave)) novasCategorias.set(chave, { nome, tipo });
    }
    if (novasCategorias.size) {
      const lista = [...novasCategorias.values()];
      const { rows } = await client.query(
        `INSERT INTO categorias (usuario_id, nome, tipo)
           SELECT $1::bigint, x.nome, x.tipo FROM unnest($2::text[], $3::text[]) AS x(nome, tipo)
           ON CONFLICT DO NOTHING RETURNING id, nome, tipo`,
        [usuarioId, lista.map((c) => c.nome), lista.map((c) => c.tipo)]
      );
      rows.forEach((r) => mapaCategoria.set(chaveCategoria(r.nome, r.tipo), r.id));
      resultado.categorias = rows.length;
    }
    const categoriaId = (nome, tipo) => (nome ? mapaCategoria.get(chaveCategoria(nome, tipo)) || null : null);

    // ---- movimentacoes (validadas antes: precisamos delas pra calcular o "ultimo mes" de cada recorrencia)
    const movimentacoes = [];
    const ultimoMesPorRecorrencia = new Map(); // indice da recorrencia -> "AAAA-MM-01" mais recente
    for (const m of backup.movimentacoes || []) {
      const descricao = texto(m && m.descricao);
      const valor = valorPositivo(m && m.valor);
      if (!m || !TIPOS_VALIDOS.includes(m.tipo) || !descricao || descricao.length > 160 || valor === null || !dataValida(m.data)) {
        aviso(`Movimentação "${descricao.slice(0, 60)}" (${m && m.data}): dados inválidos.`);
        continue;
      }
      const indiceRec = Number.isInteger(m.recorrenciaIndice) && m.recorrenciaIndice >= 0 ? m.recorrenciaIndice : null;
      movimentacoes.push({ ...m, descricao, valor, indiceRec });
      if (indiceRec !== null) {
        const mes = `${m.data.slice(0, 7)}-01`;
        const atual = ultimoMesPorRecorrencia.get(indiceRec);
        if (!atual || mes > atual) ultimoMesPorRecorrencia.set(indiceRec, mes);
      }
    }

    // ---- recorrencias (poucas: uma a uma pra saber o id novo de cada uma)
    const idNovoDaRecorrencia = new Map(); // indice no backup -> id novo
    const listaRecorrencias = backup.recorrencias || [];
    for (let i = 0; i < listaRecorrencias.length; i += 1) {
      const r = listaRecorrencias[i];
      const descricao = texto(r && r.descricao);
      const valor = valorPositivo(r && r.valor);
      const diaMes = Number(r && r.diaMes);
      if (!r || !TIPOS_VALIDOS.includes(r.tipo) || !descricao || descricao.length > 160 || valor === null
        || !Number.isInteger(diaMes) || diaMes < 1 || diaMes > 28) {
        aviso(`Recorrência "${descricao.slice(0, 60)}": dados inválidos.`);
        continue;
      }
      // ultimo_mes_gerado: o mes mais recente entre os lancamentos ligados a ela; sem nenhum, o mes atual
      // (conservador: um lancamento restaurado sem vinculo, de backup antigo, nao pode ser duplicado).
      const { rows } = await client.query(
        `INSERT INTO recorrencias (usuario_id, categoria_id, tipo, descricao, valor, dia_mes, ativa, ultimo_mes_gerado)
         VALUES ($1, $2, $3, $4, $5, $6, $7,
                 COALESCE($8::date, date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date))
         RETURNING id`,
        [usuarioId, categoriaId(r.categoriaNome, r.tipo), r.tipo, descricao, valor, diaMes, r.ativa !== false,
          ultimoMesPorRecorrencia.get(i) || null]
      );
      idNovoDaRecorrencia.set(i, rows[0].id);
      resultado.recorrencias += 1;
    }

    // ---- movimentacoes em lote
    for (let inicio = 0; inicio < movimentacoes.length; inicio += TAMANHO_LOTE) {
      const lote = movimentacoes.slice(inicio, inicio + TAMANHO_LOTE);
      const { rowCount } = await client.query(
        `INSERT INTO movimentacoes (usuario_id, categoria_id, tipo, descricao, valor, data, observacao, recorrencia_id)
           SELECT $1::bigint, x.categoria_id, x.tipo, x.descricao, x.valor, x.data, x.observacao, x.recorrencia_id
             FROM unnest($2::bigint[], $3::text[], $4::text[], $5::numeric[], $6::date[], $7::text[], $8::bigint[])
                  AS x(categoria_id, tipo, descricao, valor, data, observacao, recorrencia_id)
           ON CONFLICT DO NOTHING`,
        [
          usuarioId,
          lote.map((m) => categoriaId(m.categoriaNome, m.tipo)),
          lote.map((m) => m.tipo),
          lote.map((m) => m.descricao),
          lote.map((m) => m.valor),
          lote.map((m) => m.data),
          lote.map((m) => texto(m.observacao).slice(0, 2000) || null),
          lote.map((m) => (m.indiceRec !== null ? idNovoDaRecorrencia.get(m.indiceRec) || null : null)),
        ]
      );
      resultado.movimentacoes += rowCount;
    }

    // ---- metas em lote
    const metas = [];
    for (const m of backup.metas || []) {
      const nome = texto(m && m.nome);
      const objetivo = valorPositivo(m && m.valorObjetivo);
      const atualRaw = m && m.valorAtual != null && m.valorAtual !== "" ? Number(m.valorAtual) : 0;
      const prazoOk = !m || m.prazo == null || m.prazo === "" || dataValida(m.prazo);
      if (nome.length < 2 || nome.length > 120 || objetivo === null || !Number.isFinite(atualRaw) || atualRaw < 0
        || atualRaw > VALOR_MAXIMO || !prazoOk) {
        aviso(`Meta "${nome.slice(0, 60)}": dados inválidos.`);
        continue;
      }
      metas.push({ nome, objetivo, atual: Math.round(atualRaw * 100) / 100, prazo: m.prazo || null, descricao: texto(m.descricao).slice(0, 2000) || null });
    }
    for (let inicio = 0; inicio < metas.length; inicio += TAMANHO_LOTE) {
      const lote = metas.slice(inicio, inicio + TAMANHO_LOTE);
      const { rowCount } = await client.query(
        `INSERT INTO metas (usuario_id, nome, valor_objetivo, valor_atual, prazo, descricao)
           SELECT $1::bigint, x.nome, x.objetivo, x.atual, x.prazo, x.descricao
             FROM unnest($2::text[], $3::numeric[], $4::numeric[], $5::date[], $6::text[]) AS x(nome, objetivo, atual, prazo, descricao)`,
        [usuarioId, lote.map((m) => m.nome), lote.map((m) => m.objetivo), lote.map((m) => m.atual), lote.map((m) => m.prazo), lote.map((m) => m.descricao)]
      );
      resultado.metas += rowCount;
    }

    // ---- orcamentos (um por categoria de despesa)
    for (const o of backup.orcamentos || []) {
      const idCategoria = categoriaId(o && o.categoriaNome, "despesa");
      if (!idCategoria) {
        aviso(`Orçamento "${texto(o && o.categoriaNome)}": categoria não encontrada.`);
        continue;
      }
      const limite = valorPositivo(o.valorLimite);
      if (limite === null) {
        aviso(`Orçamento "${texto(o.categoriaNome)}": limite inválido.`);
        continue;
      }
      const { rowCount } = await client.query(
        `INSERT INTO orcamentos (usuario_id, categoria_id, valor_limite) VALUES ($1, $2, $3)
           ON CONFLICT (usuario_id, categoria_id) DO NOTHING`,
        [usuarioId, idCategoria, limite]
      );
      if (rowCount) resultado.orcamentos += 1;
      else aviso(`Orçamento "${texto(o.categoriaNome)}": já existe um orçamento para essa categoria.`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err; // o errorHandler responde 500 generico; nada ficou pela metade
  } finally {
    client.release();
  }

  if (avisosOmitidos) resultado.avisos.push(`... e mais ${avisosOmitidos} aviso(s).`);
  return resultado;
}

module.exports = { exportarTudo, restaurarTudo };
