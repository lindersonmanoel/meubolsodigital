"use strict";

const { Router } = require("express");
const { build } = require("../controllers/movimentacao.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validarIdNaRota } = require("../middleware/validarId");

/** tipoFixo: null pra /api/movimentacoes (qualquer tipo, com filtro por query),
 * "receita"/"despesa" pra /api/receitas e /api/despesas (spec secao 17). */
function buildRouter(tipoFixo) {
  const router = Router();
  const controller = build(tipoFixo);
  router.use(requireAuth);
  router.get("/", controller.listar);
  router.get("/exportar", controller.exportarCsv);
  router.get("/exportar-excel", controller.exportarExcel);
  router.post("/", controller.criar);
  router.put("/:id", validarIdNaRota, controller.atualizar);
  router.delete("/:id", validarIdNaRota, controller.remover);
  return router;
}

module.exports = buildRouter;
