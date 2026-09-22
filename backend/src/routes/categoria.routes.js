"use strict";

const { Router } = require("express");
const controller = require("../controllers/categoria.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validarIdNaRota } = require("../middleware/validarId");

const router = Router();
router.use(requireAuth);

router.get("/", controller.listar);
router.post("/", controller.criar);
router.put("/:id", validarIdNaRota, controller.atualizar);
router.delete("/:id", validarIdNaRota, controller.remover);

module.exports = router;
