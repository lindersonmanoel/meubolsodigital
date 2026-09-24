-- E-mail unico sem diferenciar maiusculas/minusculas: "Ana@x.com" e "ana@x.com" nao podem coexistir.
-- A aplicacao ja normaliza pra minusculas; este indice garante isso no banco tambem (defesa em profundidade).
--
-- Esta migracao NAO apaga dados: se ja existirem e-mails duplicados por caixa, o indice nao e' criado e
-- ela apenas avisa - revise as contas duplicadas e crie o indice depois (comando no aviso).
DO $$
DECLARE
  duplicados integer;
BEGIN
  SELECT count(*) INTO duplicados FROM (
    SELECT 1 FROM usuarios GROUP BY lower(email) HAVING count(*) > 1
  ) d;

  IF duplicados > 0 THEN
    RAISE WARNING 'Existem % e-mail(s) duplicado(s) ignorando maiusculas. Indice uq_usuarios_email_lower NAO criado. Revise e depois rode: CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_lower ON usuarios (lower(email));', duplicados;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_lower ON usuarios (lower(email));
  END IF;
END $$;
