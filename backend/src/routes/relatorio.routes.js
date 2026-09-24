"use strict";

const { Router } = require("express");
const controller = require("../controllers/dashboard.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { limitePesado } = require("../middleware/limiters");

const router = Router();
router.use(requireAuth);
router.get("/", controller.relatorio);
router.get("/exportar", limitePesado, controller.relatorioCsv);
router.get("/exportar-excel", limitePesado, controller.relatorioExcel);

module.exports = router;
