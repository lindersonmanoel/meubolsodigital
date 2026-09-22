"use strict";

const { Router } = require("express");
const controller = require("../controllers/backup.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = Router();
router.use(requireAuth);

router.get("/", controller.exportar);
router.post("/restaurar", controller.restaurar);

module.exports = router;
