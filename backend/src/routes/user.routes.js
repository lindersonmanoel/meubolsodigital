"use strict";

const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../config");
const controller = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = Router();

// Mesmo autenticado (token valido), sem limite dava pra tentar "senhaAtual" infinitas vezes -
// util pra alguem que roubou o token mas nao sabe a senha. Limite por IP, como no login.
const senhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
});

router.get("/me", requireAuth, controller.me);
router.put("/me", requireAuth, controller.updateMe);
router.put("/senha", requireAuth, senhaLimiter, controller.trocarSenha);

module.exports = router;
