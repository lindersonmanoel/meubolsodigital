-- Uma recorrencia so' pode gerar UMA movimentacao por mes (evita duplicar quando o dashboard
-- e' aberto em duas abas/dispositivos ao mesmo tempo). O codigo insere com ON CONFLICT DO NOTHING.
--
-- IMPORTANTE: esta migracao NAO apaga dados. Se ja existirem duplicatas geradas por recorrencia
-- (mesma recorrencia, mesmo mes), o indice nao e' criado e a migracao apenas avisa - a pessoa
-- responsavel decide o que manter e cria o indice depois (comando no aviso).
DO $$
DECLARE
  duplicadas integer;
BEGIN
  SELECT count(*) INTO duplicadas FROM (
    SELECT 1
      FROM movimentacoes
     WHERE recorrencia_id IS NOT NULL
     GROUP BY recorrencia_id, date_trunc('month', data::timestamp)
    HAVING count(*) > 1
  ) d;

  IF duplicadas > 0 THEN
    RAISE WARNING 'Existem % grupo(s) de movimentacoes duplicadas por recorrencia/mes. Indice uq_mov_recorrencia_mes NAO criado. Revise as duplicatas e depois rode: CREATE UNIQUE INDEX IF NOT EXISTS uq_mov_recorrencia_mes ON movimentacoes (recorrencia_id, (date_trunc(''month'', data::timestamp))) WHERE recorrencia_id IS NOT NULL;', duplicadas;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_mov_recorrencia_mes
      ON movimentacoes (recorrencia_id, (date_trunc('month', data::timestamp)))
      WHERE recorrencia_id IS NOT NULL;
  END IF;
END $$;
