-- Meu Bolso Digital - recuperacao de senha por e-mail.
-- Guarda so' o hash sha256 do token (nunca o token em texto puro) - igual a senha,
-- se o banco vazar ninguem usa os links validos direto.

CREATE TABLE IF NOT EXISTS tokens_recuperacao_senha (
    id         BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expira_em  TIMESTAMPTZ NOT NULL,
    usado_em   TIMESTAMPTZ,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tokens_recuperacao_usuario ON tokens_recuperacao_senha (usuario_id);
