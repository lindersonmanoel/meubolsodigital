"use strict";

const config = require("./config");
const createApp = require("./app");

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Meu Bolso Digital API rodando na porta ${config.port} (ambiente: ${config.nodeEnv})`);
});
