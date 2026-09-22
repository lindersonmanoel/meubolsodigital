-- Meu Bolso Digital - recorrencias (receitas/despesas fixas) e orcamentos por categoria.

CREATE TABLE IF NOT EXISTS recorrencias (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id  BIGINT REFERENCES categorias(id) ON DELETE SET NULL,
    tipo          VARCHAR(10) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    descricao     VARCHAR(160) NOT NULL,
    valor         NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
    dia_mes       SMALLINT NOT NULL CHECK (dia_mes BETWEEN 1 AND 28),
    ativa         BOOLEAN NOT NULL DEFAULT true,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Liga cada movimentacao gerada automaticamente a' recorrencia que a originou, pra nao
-- duplicar (uma por mes) e pra saber quais movimentacoes vieram de uma recorrencia.
ALTER TABLE movimentacoes
    ADD COLUMN IF NOT EXISTS recorrencia_id BIGINT REFERENCES recorrencias(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS orcamentos (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id  BIGINT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    valor_limite  NUMERIC(12, 2) NOT NULL CHECK (valor_limite > 0),
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS idx_recorrencias_usuario ON recorrencias (usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_recorrencia ON movimentacoes (recorrencia_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_usuario ON orcamentos (usuario_id);
