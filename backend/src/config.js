"use strict";

require("dotenv").config();

const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];

function boolFromEnv(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on", "sim"].includes(String(value).trim().toLowerCase());
}

function buildConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  if (isProduction) {
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]);
    if (missing.length) {
      throw new Error(
        `Faltam variáveis de ambiente obrigatórias em produção: ${missing.join(", ")}. Preencha o .env.`
      );
    }
  }

  const jwtSecret = process.env.JWT_SECRET || (isProduction ? "" : "chave-apenas-para-desenvolvimento-local");
  if (!isProduction && !process.env.JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.warn(
      "[config] JWT_SECRET não definido: usando uma chave fixa de desenvolvimento. Defina JWT_SECRET no .env antes de ir para produção."
    );
  }

  return {
    nodeEnv,
    isProduction,
    isTest: nodeEnv === "test",
    port: Number(process.env.PORT) || 3000,
    databaseUrl: process.env.DATABASE_URL || "",
    databaseSsl: boolFromEnv(process.env.DATABASE_SSL, false),
    databaseSslCa: process.env.DATABASE_SSL_CA ? process.env.DATABASE_SSL_CA.replace(/\\n/g, "\n") : "",
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    // FRONTEND_URL aceita varias origens separadas por virgula (ex.: dominio novo + endereco antigo
    // durante uma migracao). A PRIMEIRA e' a principal (usada no link do e-mail de recuperacao).
    frontendUrls: (process.env.FRONTEND_URL || "http://localhost:5500")
      .split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean),
    frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5500").split(",")[0].trim().replace(/\/+$/, ""),
    // Em teste desligado por padrao: os testes criam as proprias categorias e assumem conta vazia.
    categoriasPadrao: boolFromEnv(process.env.SEED_CATEGORIAS_PADRAO, nodeEnv !== "test"),
    resendApiKey: process.env.RESEND_API_KEY || "",
    emailFrom: process.env.EMAIL_FROM || "Meu Bolso Digital <onboarding@resend.dev>",
  };
}

module.exports = buildConfig();
