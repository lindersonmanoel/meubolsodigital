"use strict";

const { Router } = require("express");
const controller = require("../controllers/backup.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { limitePesado } = require("../middleware/limiters");

const router = Router();
router.use(requireAuth);

router.get("/", limitePesado, controller.exportar);
router.post("/restaurar", limitePesado, controller.restaurar);

module.exports = router;
