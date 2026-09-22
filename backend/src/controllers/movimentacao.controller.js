"use strict";

const service = require("../services/movimentacao.service");
const { paraCsv } = require("../utils/csv");

const COLUNAS_CSV = [
  { chave: "data", rotulo: "Data" },
  { chave: "tipo", rotulo: "Tipo" },
  { chave: "descricao", rotulo: "Descrição" },
  { chave: "categoria_nome", rotulo: "Categoria" },
  { chave: "valor", rotulo: "Valor" },
  { chave: "observacao", rotulo: "Observação" },
];

/** Fabrica os handlers; tipoFixo faz as rotas /api/receitas e /api/despesas se
 * comportarem como uma "movimentacoes" pre-filtrada, sem duplicar logica. */
function build(tipoFixo) {
  return {
    async listar(req, res, next) {
      try {
        const itens = await service.listar(req.usuarioId, req.query, { tipoFixo });
        res.json({ movimentacoes: itens });
      } catch (err) {
        next(err);
      }
    },
    async criar(req, res, next) {
      try {
        const item = await service.criar(req.usuarioId, req.body || {}, { tipoFixo });
        res.status(201).json({ movimentacao: item });
      } catch (err) {
        next(err);
      }
    },
    async atualizar(req, res, next) {
      try {
        const item = await service.atualizar(req.usuarioId, req.params.id, req.body || {}, { tipoFixo });
        res.json({ movimentacao: item });
      } catch (err) {
        next(err);
      }
    },
    async remover(req, res, next) {
      try {
        await service.remover(req.usuarioId, req.params.id);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
    async exportarCsv(req, res, next) {
      try {
        const itens = await service.listar(req.usuarioId, req.query, { tipoFixo });
        const csv = paraCsv(itens, COLUNAS_CSV);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="movimentacoes.csv"`);
        res.send(csv);
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { build };
