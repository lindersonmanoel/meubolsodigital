"use strict";

const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../config");
const controller = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = Router();

// Limite de tentativas de cadastro/login por IP (mesmo limitador nas duas rotas, contra
// forca bruta e enumeracao de e-mails). Em teste automatizado o limite sobe bastante: os
// proprios testes fazem dezenas de cadastros/logins legitimos, e o mecanismo do limitador
// em si e verificado a parte, isolado, em tests/rateLimit.test.js.
function createAuthLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isTest ? 1000 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
  });
}

const authLimiter = createAuthLimiter();

router.post("/register", authLimiter, controller.register);
router.post("/login", authLimiter, controller.login);
router.post("/logout", controller.logout);
router.get("/me", requireAuth, controller.me);

module.exports = router;
module.exports.createAuthLimiter = createAuthLimiter;
