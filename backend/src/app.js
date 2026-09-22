"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const config = require("./config");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const categoriaRoutes = require("./routes/categoria.routes");
const movimentacaoRoutes = require("./routes/movimentacao.routes");
const metaRoutes = require("./routes/meta.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const relatorioRoutes = require("./routes/relatorio.routes");
const recorrenciaRoutes = require("./routes/recorrencia.routes");
const orcamentoRoutes = require("./routes/orcamento.routes");
const backupRoutes = require("./routes/backup.routes");
const errorHandler = require("./middleware/errorHandler");

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Em produção, so o FRONTEND_URL configurado passa (CORS estrito, como deve ser).
// Fora de producao, "localhost" e "127.0.0.1" sao tratados como equivalentes - pro
// navegador sao origens diferentes mesmo apontando pra mesma maquina, e a pessoa pode
// abrir o frontend por qualquer um dos dois sem precisar bater exatamente com o .env.
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true); // sem Origin: curl, apps mobile, etc.
  if (origin === config.frontendUrl) return callback(null, true);
  if (!config.isProduction) {
    try {
      if (LOCAL_HOSTNAMES.has(new URL(origin).hostname)) return callback(null, true);
    } catch (e) {
      /* Origin invalido: cai no bloqueio abaixo */
    }
  }
  return callback(new Error("Origem não permitida pelo CORS."));
}

function createApp() {
  const app = express();

  // Em produção a API roda atrás de um proxy (Railway, Cloudflare Tunnel etc.): sem isso,
  // o express-rate-limit rejeita toda requisição por causa do cabeçalho X-Forwarded-For
  // (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) e req.ip fica errado (sempre o IP do proxy).
  // "1" confia só no primeiro salto (o proxy imediatamente na frente), não a cadeia toda.
  if (config.isProduction) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(compression()); // comprime as respostas (json e o csv exportado ficam bem menores)
  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  // 1mb pra caber a foto de perfil em base64 (limitada a ~700kb na validacao do controller);
  // as outras rotas continuam com corpos bem menores que isso na pratica.
  app.use(express.json({ limit: "1mb" }));
  if (!config.isTest) {
    app.use(morgan(config.isProduction ? "combined" : "dev"));
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ambiente: config.nodeEnv });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/categorias", categoriaRoutes);
  app.use("/api/movimentacoes", movimentacaoRoutes(null));
  app.use("/api/receitas", movimentacaoRoutes("receita"));
  app.use("/api/despesas", movimentacaoRoutes("despesa"));
  app.use("/api/metas", metaRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/relatorios", relatorioRoutes);
  app.use("/api/recorrencias", recorrenciaRoutes);
  app.use("/api/orcamentos", orcamentoRoutes);
  app.use("/api/backup", backupRoutes);

  app.use((_req, res) => {
    res.status(404).json({ erro: "Rota não encontrada." });
  });
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
