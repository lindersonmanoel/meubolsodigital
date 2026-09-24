-- Totais do dashboard/relatorios e o grafico mensal filtram por usuario + tipo + periodo: este indice
-- cobre esse acesso (antes so' havia usuario + data). IF NOT EXISTS: pode rodar de novo sem problema.
CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuario_tipo_data ON movimentacoes (usuario_id, tipo, data DESC);
