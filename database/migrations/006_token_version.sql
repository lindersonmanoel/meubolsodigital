-- Invalida sessoes (JWT) antigas quando a senha muda.
-- O token carrega a versao ("tv"); trocar/redefinir a senha incrementa token_version, e o
-- middleware de autenticacao recusa tokens cuja versao nao bate com a do banco.
-- Tokens ja emitidos (sem "tv") contam como versao 0 e seguem validos ate a proxima troca de senha.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
