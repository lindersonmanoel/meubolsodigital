"use strict";

module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["<rootDir>/tests/env.setup.js"],
  // Os testes usam PostgreSQL e bcrypt de verdade: 5 s (padrao) estoura em maquina/CI carregado sem haver erro real.
  testTimeout: 30000,
  verbose: true,
};
