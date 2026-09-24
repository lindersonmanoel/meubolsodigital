"use strict";

const { Resend } = require("resend");
const config = require("../config");

// Dois provedores possiveis: SMTP (SMTP_HOST definido; funciona com qualquer conta de e-mail, inclusive
// Gmail com senha de app, sem precisar de dominio proprio) ou Resend (RESEND_API_KEY). SMTP tem prioridade.
const resend = !config.smtpHost && config.resendApiKey ? new Resend(config.resendApiKey) : null;
const smtp = config.smtpHost
  ? require("nodemailer").createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
  })
  : null;

const REMETENTE_DE_TESTE = /@resend\.dev\b/i;

/**
 * Estado do envio de e-mail (sem segredos), usado no /api/health/ready e no aviso da subida:
 *  - "smtp" / "resend": pronto pra enviar a qualquer pessoa;
 *  - "resend_remetente_de_teste": o remetente onboarding@resend.dev so' entrega ao dono da conta Resend;
 *  - "smtp_sem_remetente": SMTP configurado, mas EMAIL_FROM ainda e' o remetente de teste;
 *  - "sem_provedor": nada configurado (o "esqueci minha senha" nao envia e-mail).
 */
function estadoEmail() {
  if (config.smtpHost) return REMETENTE_DE_TESTE.test(config.emailFrom) ? "smtp_sem_remetente" : "smtp";
  if (!config.resendApiKey) return "sem_provedor";
  return REMETENTE_DE_TESTE.test(config.emailFrom) ? "resend_remetente_de_teste" : "resend";
}

/** Mensagem de atencao quando o e-mail de recuperacao nao vai funcionar pra todo mundo (ou null se esta ok). */
function avisoConfiguracaoEmail() {
  switch (estadoEmail()) {
    case "sem_provedor":
      return "[email] ATENÇÃO: nenhum provedor de e-mail configurado (defina SMTP_HOST ou RESEND_API_KEY). O \"esqueci minha senha\" NÃO envia e-mail.";
    case "resend_remetente_de_teste":
      return "[email] ATENÇÃO: o remetente de teste da Resend (onboarding@resend.dev) só entrega ao dono da conta Resend. Verifique um domínio na Resend e ajuste EMAIL_FROM, ou use SMTP (SMTP_HOST).";
    case "smtp_sem_remetente":
      return "[email] ATENÇÃO: SMTP configurado, mas EMAIL_FROM ainda é o remetente de teste. Defina EMAIL_FROM com o endereço da conta SMTP.";
    default:
      return null;
  }
}

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
  if (!resend && !smtp) {
    // Sem provedor configurado (dev/teste, ou producao ainda nao configurada) - nao quebra o fluxo,
    // so' nao manda o e-mail de verdade. O link contem o token de redefinicao: so' vai pro log
    // fora de producao.
    if (config.isProduction) {
      // eslint-disable-next-line no-console
      console.warn("[email] nenhum provedor de e-mail configurado - e-mail de recuperação NÃO enviado.");
    } else {
      // eslint-disable-next-line no-console
      console.warn("[email] nenhum provedor de e-mail configurado - link de recuperação ficou só no log:", link);
    }
    return;
  }

  const nomeSeguro = nome ? escaparHtml(nome) : "";
  const assunto = "Recupere sua senha - Meu Bolso Digital";
  const html = `
      <p>Oi${nomeSeguro ? `, ${nomeSeguro}` : ""}!</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no Meu Bolso Digital.</p>
      <p><a href="${link}">Clique aqui para criar uma senha nova</a>. O link vale por 1 hora.</p>
      <p>Se você não pediu isso, pode ignorar este e-mail com segurança - sua senha continua a mesma.</p>
    `;
  const texto = `Oi${nome ? `, ${nome}` : ""}!\n\nRecebemos um pedido para redefinir a senha da sua conta no Meu Bolso Digital.\n`
    + `Acesse o link para criar uma senha nova (vale por 1 hora):\n${link}\n\n`
    + "Se você não pediu isso, pode ignorar este e-mail com segurança - sua senha continua a mesma.\n";

  // Nao relanca erro de proposito: a rota responde sempre igual, exista ou nao a conta (evita
  // enumeracao de e-mails). Mas a falha NAO passa em silencio: vai pro log (sem o link/token).
  try {
    if (smtp) {
      await smtp.sendMail({ from: config.emailFrom, to: para, subject: assunto, html, text: texto });
      return;
    }
    // O SDK do Resend devolve { error } em vez de lancar excecao.
    const { error } = await resend.emails.send({ from: config.emailFrom, to: para, subject: assunto, html });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[email] falha ao enviar recuperação de senha:", error.name || "", error.message || error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] falha ao enviar recuperação de senha:", (err && (err.code || err.name)) || "", (err && err.message) || err);
  }
}

module.exports = { enviarRecuperacaoSenha, estadoEmail, avisoConfiguracaoEmail };
