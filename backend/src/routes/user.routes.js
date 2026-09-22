"use strict";

const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = Router();

router.get("/me", requireAuth, controller.me);
router.put("/me", requireAuth, controller.updateMe);
router.put("/senha", requireAuth, controller.trocarSenha);

module.exports = router;
