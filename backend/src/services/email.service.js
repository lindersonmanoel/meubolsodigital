"use strict";

const { Resend } = require("resend");
const config = require("../config");

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

async function enviarRecuperacaoSenha({ para, nome, link }) {
  if (!resend) {
    // Sem RESEND_API_KEY configurada (dev/teste, ou producao ainda nao configurada) - nao
    // quebra o fluxo, so' nao manda o e-mail de verdade. Fica no log pra testar manualmente.
    // eslint-disable-next-line no-console
    console.warn("[email] RESEND_API_KEY não configurada - link de recuperação ficou só no log:", link);
    return;
  }

  const nomeSeguro = nome ? escaparHtml(nome) : "";
  await resend.emails.send({
    from: config.emailFrom,
    to: para,
    subject: "Recupere sua senha - Meu Bolso Digital",
    html: `
      <p>Oi${nomeSeguro ? `, ${nomeSeguro}` : ""}!</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no Meu Bolso Digital.</p>
      <p><a href="${link}">Clique aqui para criar uma senha nova</a>. O link vale por 1 hora.</p>
      <p>Se você não pediu isso, pode ignorar este e-mail com segurança - sua senha continua a mesma.</p>
    `,
  });
}

module.exports = { enviarRecuperacaoSenha };
