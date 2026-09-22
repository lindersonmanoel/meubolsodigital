"use strict";

const { Router } = require("express");
const controller = require("../controllers/dashboard.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = Router();
router.use(requireAuth);
router.get("/", controller.relatorio);
router.get("/exportar", controller.relatorioCsv);

module.exports = router;
