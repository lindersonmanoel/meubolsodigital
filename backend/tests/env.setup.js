"use strict";

// Carrega backend/.env.test antes de qualquer teste (e antes de src/config.js ler
// process.env), pra usar um banco e um segredo separados dos de desenvolvimento.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.test") });
