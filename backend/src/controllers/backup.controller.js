"use strict";

const service = require("../services/backup.service");

async function exportar(req, res, next) {
  try {
    const dados = await service.exportarTudo(req.usuarioId);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="backup-meu-bolso-digital.json"`);
    res.send(JSON.stringify(dados, null, 2));
  } catch (err) {
    next(err);
  }
}

async function restaurar(req, res, next) {
  try {
    const resultado = await service.restaurarTudo(req.usuarioId, req.body);
    res.json({ mensagem: "Backup restaurado.", resultado });
  } catch (err) {
    next(err);
  }
}

module.exports = { exportar, restaurar };
