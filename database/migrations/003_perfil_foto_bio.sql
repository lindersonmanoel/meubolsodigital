-- Meu Bolso Digital - foto de perfil e bio.
-- foto_url guarda a imagem como data URL (base64) direto no banco - simples, sem precisar de
-- um servico de armazenamento de arquivos externo. O tamanho e' limitado na validacao da API
-- (backend/src/controllers/auth.controller.js), nao aqui no banco.

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS bio VARCHAR(280),
    ADD COLUMN IF NOT EXISTS foto_url TEXT;
