-- Marca ate' que mes cada recorrencia ja foi processada (ultimo_mes_gerado = primeiro dia do mes).
-- Serve pra 2 coisas:
--  1) preencher meses em que a pessoa nao abriu o app (so' os meses DEPOIS do ultimo processado);
--  2) NAO recriar um lancamento que a pessoa apagou de proposito (o mes ja consta como processado).
-- Recorrencias que ainda nao geraram nada ficam NULL: a geracao parte do mes em que foram criadas.
ALTER TABLE recorrencias ADD COLUMN IF NOT EXISTS ultimo_mes_gerado DATE;

UPDATE recorrencias r
   SET ultimo_mes_gerado = m.mes
  FROM (
    SELECT recorrencia_id, date_trunc('month', max(data)::timestamp)::date AS mes
      FROM movimentacoes
     WHERE recorrencia_id IS NOT NULL
     GROUP BY recorrencia_id
  ) m
 WHERE r.id = m.recorrencia_id
   AND r.ultimo_mes_gerado IS NULL;
