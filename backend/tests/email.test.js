"use strict";

// Servico de e-mail: falha de envio nao pode passar em silencio, e o link (com o token de
// redefinicao) nao pode ir pro log em producao. O SDK do Resend e' simulado (sem rede).

const CHAVES = [
  "RESEND_API_KEY", "NODE_ENV", "DATABASE_URL", "JWT_SECRET", "FRONTEND_URL",
  "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM",
];
const LINK = "https://app.exemplo.com/redefinir-senha.html?token=SEGREDO123";

let salvas;
beforeEach(() => {
  salvas = {};
  CHAVES.forEach((k) => { salvas[k] = process.env[k]; });
});
afterEach(() => {
  CHAVES.forEach((k) => {
    if (salvas[k] === undefined) delete process.env[k];
    else process.env[k] = salvas[k];
  });
  jest.dontMock("resend");
  jest.dontMock("nodemailer");
  jest.restoreAllMocks();
});

/** Carrega o email.service isolado, com as variaveis de ambiente pedidas e o Resend simulado. */
function carregar(env, send, sendMail) {
  // Sem SMTP nem Resend explicitos, garante um ambiente limpo (o .env local nao pode influenciar).
  ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM", "RESEND_API_KEY"].forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  let modulo;
  jest.isolateModules(() => {
    if (send) jest.doMock("resend", () => ({ Resend: jest.fn(() => ({ emails: { send } })) }));
    if (sendMail) jest.doMock("nodemailer", () => ({ createTransport: jest.fn(() => ({ sendMail })) }));
    modulo = require("../src/services/email.service");
  });
  return modulo;
}

describe("email.service", () => {
  test("registra no log quando o Resend devolve { error } (antes: falha silenciosa) e nao lanca", async () => {
    const send = jest.fn().mockResolvedValue({ data: null, error: { name: "validation_error", message: "dominio nao verificado" } });
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const { enviarRecuperacaoSenha } = carregar({ RESEND_API_KEY: "re_teste" }, send);

    await expect(enviarRecuperacaoSenha({ para: "a@b.co", nome: "Ana", link: LINK })).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("falha ao enviar"), "validation_error", "dominio nao verificado");
    // o log de erro nao pode conter o link/token
    expect(JSON.stringify(erro.mock.calls)).not.toContain("SEGREDO123");
  });

  test("envio com sucesso nao gera log de erro", async () => {
    const send = jest.fn().mockResolvedValue({ data: { id: "abc" }, error: null });
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const { enviarRecuperacaoSenha } = carregar({ RESEND_API_KEY: "re_teste" }, send);

    await enviarRecuperacaoSenha({ para: "a@b.co", nome: "Ana", link: LINK });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "a@b.co" });
    expect(erro).not.toHaveBeenCalled();
  });

  test("sem chave, fora de producao, o link vai pro log (para testar na mao)", async () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { enviarRecuperacaoSenha } = carregar({ RESEND_API_KEY: "" });

    await enviarRecuperacaoSenha({ para: "a@b.co", nome: "Ana", link: LINK });

    expect(JSON.stringify(aviso.mock.calls)).toContain("SEGREDO123");
  });

  test("sem chave, em producao, o link/token NAO vai pro log", async () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { enviarRecuperacaoSenha } = carregar({
      RESEND_API_KEY: "", NODE_ENV: "production", DATABASE_URL: "postgresql://x:y@localhost:5432/z",
      JWT_SECRET: "segredo-de-teste", FRONTEND_URL: "https://app.exemplo.com",
    });

    await enviarRecuperacaoSenha({ para: "a@b.co", nome: "Ana", link: LINK });

    expect(aviso).toHaveBeenCalled();
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("SEGREDO123");
  });
});

describe("SMTP como alternativa ao Resend (funciona sem dominio proprio)", () => {
  const SMTP = {
    SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "587", SMTP_USER: "app@gmail.com", SMTP_PASS: "senha-de-app",
    EMAIL_FROM: "Meu Bolso Digital <app@gmail.com>",
  };

  test("envia pelo SMTP (com versao em texto) e nao usa o Resend", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "1" });
    const send = jest.fn();
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const { enviarRecuperacaoSenha } = carregar({ ...SMTP, RESEND_API_KEY: "re_teste" }, send, sendMail);

    await enviarRecuperacaoSenha({ para: "ana@example.com", nome: "Ana", link: LINK });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled(); // SMTP tem prioridade
    const msg = sendMail.mock.calls[0][0];
    expect(msg).toMatchObject({ from: SMTP.EMAIL_FROM, to: "ana@example.com", subject: expect.stringMatching(/Recupere sua senha/) });
    expect(msg.html).toContain(LINK);
    expect(msg.text).toContain(LINK);
    expect(erro).not.toHaveBeenCalled();
  });

  test("falha do SMTP vai pro log (sem o link/token) e nao lanca", async () => {
    const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error("Invalid login: 535 senha recusada"), { code: "EAUTH" }));
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const { enviarRecuperacaoSenha } = carregar(SMTP, null, sendMail);

    await expect(enviarRecuperacaoSenha({ para: "ana@example.com", nome: "Ana", link: LINK })).resolves.toBeUndefined();

    expect(erro).toHaveBeenCalledWith(expect.stringContaining("falha ao enviar"), "EAUTH", "Invalid login: 535 senha recusada");
    expect(JSON.stringify(erro.mock.calls)).not.toContain("SEGREDO123");
  });
});

describe("estado do e-mail: visivel em vez de falhar em silencio (BUG-01)", () => {
  const casos = [
    ["nada configurado", {}, "sem_provedor", /nenhum provedor/i],
    ["Resend com remetente de teste", { RESEND_API_KEY: "re_x" }, "resend_remetente_de_teste", /só entrega ao dono/],
    ["Resend com dominio proprio", { RESEND_API_KEY: "re_x", EMAIL_FROM: "App <nao-responda@mail.exemplo.com.br>" }, "resend", null],
    ["SMTP com remetente proprio", { SMTP_HOST: "smtp.gmail.com", EMAIL_FROM: "App <app@gmail.com>" }, "smtp", null],
    ["SMTP mas remetente de teste", { SMTP_HOST: "smtp.gmail.com" }, "smtp_sem_remetente", /EMAIL_FROM/],
  ];

  test.each(casos)("%s -> %s", (_nome, env, estado, aviso) => {
    const { estadoEmail, avisoConfiguracaoEmail } = carregar(env, null, jest.fn());
    expect(estadoEmail()).toBe(estado);
    const msg = avisoConfiguracaoEmail();
    if (aviso) expect(msg).toMatch(aviso);
    else expect(msg).toBeNull();
  });
});
