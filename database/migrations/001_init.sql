-- Meu Bolso Digital - schema inicial
-- Cria as 4 tabelas principais do documento de desenvolvimento (secao 15).
-- As tabelas de categorias, movimentacoes e metas ja entram no schema (evita migracao
-- futura so para isso), mas as rotas da API para elas so chegam na Fase 3 em diante.

CREATE TABLE IF NOT EXISTS usuarios (
    id            BIGSERIAL PRIMARY KEY,
    nome          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) NOT NULL UNIQUE,
    senha_hash    VARCHAR(255) NOT NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias (
    id         BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome       VARCHAR(80) NOT NULL,
    tipo       VARCHAR(10) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, nome, tipo)
);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id  BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
    tipo          VARCHAR(10) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    descricao     VARCHAR(160) NOT NULL,
    valor         NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    data          DATE NOT NULL,
    observacao    TEXT,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metas (
    id             BIGSERIAL PRIMARY KEY,
    usuario_id     BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome           VARCHAR(120) NOT NULL,
    valor_objetivo NUMERIC(12, 2) NOT NULL CHECK (valor_objetivo > 0),
    valor_atual    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_atual >= 0),
    prazo          DATE,
    descricao      TEXT,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_usuario ON categorias (usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuario_data ON movimentacoes (usuario_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_categoria ON movimentacoes (categoria_id);
CREATE INDEX IF NOT EXISTS idx_metas_usuario ON metas (usuario_id);
