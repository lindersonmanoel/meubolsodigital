"use strict";

// Hash de senha com bcrypt NATIVO (@node-rs/bcrypt, escrito em Rust). Diferente do bcryptjs (JavaScript puro),
// roda fora da thread principal do Node: varios logins/cadastros ao mesmo tempo nao travam o resto da API.
// Verifica os hashes que ja estao no banco ($2a$ / $2b$, gerados pelo bcryptjs) sem nenhuma migracao.
const bcrypt = require("@node-rs/bcrypt");

module.exports = {
  /** Gera o hash (assincrono, fora da thread principal). custo = rodadas (12 em producao). */
  hash: (senha, custo) => bcrypt.hash(senha, custo),
  /** Confere a senha contra um hash existente. */
  compare: (senha, hash) => bcrypt.compare(senha, hash),
  /** Versao sincrona (so' pra montar constantes na subida). */
  hashSync: (senha, custo) => bcrypt.hashSync(senha, custo),
};
