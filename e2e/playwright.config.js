"use strict";

const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

// Todos os projetos usam Chromium (so' ele e' instalado no CI); os "celulares" sao emulacao de tela/toque/user agent.
const chromium = (dispositivo) => ({ ...devices[dispositivo], browserName: "chromium", defaultBrowserType: "chromium" });

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:5500", trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /(fluxo|seguranca)\.spec\.js/ },
    { name: "iphone", use: chromium("iPhone 13"), testMatch: /(fluxo|mobile)\.spec\.js/ },
    { name: "pixel", use: chromium("Pixel 5"), testMatch: /mobile\.spec\.js/ },
    { name: "estreito", use: { ...chromium("Pixel 5"), viewport: { width: 320, height: 640 } }, testMatch: /mobile\.spec\.js/ },
  ],
  // Sobe o backend (NODE_ENV=test: limites altos e CORS liberado pra localhost) e o site estatico. No CI o
  // PostgreSQL ja existe (service) e as migracoes foram aplicadas antes; localmente, use DATABASE_URL.
  webServer: [
    {
      command: "node ../backend/src/server.js",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: "test",
        PORT: "3000",
        JWT_SECRET: process.env.JWT_SECRET || "segredo-e2e",
        FRONTEND_URL: "http://localhost:5500",
        DATABASE_URL: process.env.DATABASE_URL || "",
      },
    },
    {
      // -c com caminho ABSOLUTO: o serve resolve o caminho relativo a partir da pasta servida (frontend/), nao daqui.
      command: `node gerar-serve-json.js && npx serve -l 5500 -c "${path.join(__dirname, "serve.json")}" ../frontend`,
      url: "http://localhost:5500/login",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
