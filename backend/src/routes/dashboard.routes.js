"use strict";

const { Router } = require("express");
const controller = require("../controllers/dashboard.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = Router();
router.use(requireAuth);

router.get("/resumo", controller.resumo);
router.get("/graficos", controller.graficos);

module.exports = router;
