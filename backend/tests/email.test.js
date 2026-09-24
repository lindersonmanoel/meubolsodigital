"use strict";

// Servico de e-mail: falha de envio nao pode passar em silencio, e o link (com o token de
// redefinicao) nao pode ir pro log em producao. O SDK do Resend e' simulado (sem rede).

const CHAVES = ["RESEND_API_KEY", "NODE_ENV", "DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];
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
  jest.restoreAllMocks();
});

/** Carrega o email.service isolado, com as variaveis de ambiente pedidas e o Resend simulado. */
function carregar(env, send) {
  Object.assign(process.env, env);
  let modulo;
  jest.isolateModules(() => {
    if (send) jest.doMock("resend", () => ({ Resend: jest.fn(() => ({ emails: { send } })) }));
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
