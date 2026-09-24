#!/usr/bin/env bash
# ENSAIO das migracoes numa COPIA do banco: restaura um backup (pg_dump -Fc) num PostgreSQL temporario, aplica as
# migracoes pendentes deste repositorio e mostra o que mudou. Nada toca no banco real. Use ANTES de publicar o backend.
#
# Uso:   bash scripts/ensaiar-migracoes.sh caminho/do/backup.dump
# Precisa de Docker. Sai com codigo 0 se tudo aplicou sem perder linhas; 1 se algo falhou; 3 se aplicou mas houve AVISOS
# (ex.: duplicatas que impedem criar um indice unico) - leia a saida antes de publicar.
set -u

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Uso: bash scripts/ensaiar-migracoes.sh caminho/do/backup.dump" >&2
  exit 2
fi
command -v docker >/dev/null 2>&1 || { echo "Precisa do Docker instalado e ligado." >&2; exit 2; }

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
# caminho para montar no Docker (Git Bash no Windows precisa do formato do Windows; Linux/Mac usam o normal)
caminho() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }
DUMP_DIR="$(caminho "$(dirname "$DUMP")")"
DUMP_NOME="$(basename "$DUMP")"
REPO_DIR="$(caminho "$RAIZ")"

ID="$$"
REDE="ensaio-mig-$ID"
PG="ensaio-pg-$ID"
SENHA="ensaio-$ID"
export MSYS_NO_PATHCONV=1

limpar() {
  docker rm -f "$PG" >/dev/null 2>&1
  docker network rm "$REDE" >/dev/null 2>&1
}
trap limpar EXIT

psql_q() { docker exec -e PGPASSWORD="$SENHA" "$PG" psql -U mbd -d ensaio -tAc "$1" 2>/dev/null; }
contagens() {
  for t in usuarios categorias movimentacoes recorrencias orcamentos metas; do
    printf "  %-15s %s\n" "$t" "$(psql_q "SELECT count(*) FROM $t" || echo '?')"
  done
}
total_linhas() {
  psql_q "SELECT (SELECT count(*) FROM usuarios)||'/'||(SELECT count(*) FROM categorias)||'/'||(SELECT count(*) FROM movimentacoes)||'/'||(SELECT count(*) FROM recorrencias)||'/'||(SELECT count(*) FROM orcamentos)||'/'||(SELECT count(*) FROM metas)"
}

echo "== 1/4  Subindo um PostgreSQL temporario (descartado no fim)"
docker network create "$REDE" >/dev/null || exit 1
docker run -d --name "$PG" --network "$REDE" -e POSTGRES_USER=mbd -e POSTGRES_PASSWORD="$SENHA" -e POSTGRES_DB=ensaio \
  --tmpfs /var/lib/postgresql/data postgres:16-alpine >/dev/null || exit 1
for _ in $(seq 1 40); do
  docker exec "$PG" pg_isready -U mbd -d ensaio >/dev/null 2>&1 && break
  sleep 1
done

echo "== 2/4  Restaurando o backup ($DUMP_NOME)"
docker run --rm --network "$REDE" -e PGPASSWORD="$SENHA" -v "$DUMP_DIR:/dump:ro" postgres:16-alpine \
  pg_restore -h "$PG" -U mbd -d ensaio --no-owner --no-privileges "/dump/$DUMP_NOME" 2>&1 | tail -5
ANTES="$(total_linhas)"
if [ -z "$ANTES" ]; then
  echo "ERRO: o backup nao restaurou as tabelas esperadas (usuarios, categorias, movimentacoes...)." >&2
  exit 1
fi
echo "Linhas ANTES:"; contagens
echo "Migracoes ja aplicadas: $(psql_q "SELECT string_agg(nome, ', ' ORDER BY nome) FROM _migrations")"

echo "== 3/4  Aplicando as migracoes deste repositorio"
SAIDA="$(docker run --rm --network "$REDE" -v "$REPO_DIR:/repo:ro" \
  -e DATABASE_URL="postgresql://mbd:$SENHA@$PG:5432/ensaio" -e JWT_SECRET=ensaio node:20-alpine sh -c '
    cp -r /repo /app && cd /app/backend && rm -rf node_modules &&
    npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1 &&
    node src/database/migrate.js' 2>&1)"
CODIGO=$?
echo "$SAIDA" | sed 's/^/  /'

echo "== 4/4  Conferindo o resultado"
DEPOIS="$(total_linhas)"
echo "Linhas DEPOIS:"; contagens
echo "Migracoes aplicadas agora: $(psql_q "SELECT count(*) FROM _migrations")"
echo "Indices novos: $(psql_q "SELECT coalesce(string_agg(indexname, ', '), 'nenhum') FROM pg_indexes WHERE indexname IN ('uq_mov_recorrencia_mes','uq_usuarios_email_lower','idx_movimentacoes_usuario_tipo_data')")"
echo "Colunas novas: $(psql_q "SELECT coalesce(string_agg(table_name||'.'||column_name, ', '), 'nenhuma') FROM information_schema.columns WHERE (table_name='usuarios' AND column_name='token_version') OR (table_name='recorrencias' AND column_name='ultimo_mes_gerado')")"

RESULTADO=0
if [ "$CODIGO" -ne 0 ]; then
  echo; echo "RESULTADO: FALHOU - alguma migracao deu erro (veja acima). NAO publique ate resolver." ; exit 1
fi
if [ "$ANTES" != "$DEPOIS" ]; then
  echo; echo "RESULTADO: FALHOU - o numero de linhas mudou ($ANTES -> $DEPOIS). NAO publique."; exit 1
fi
if echo "$SAIDA" | grep -qi "aviso do banco"; then
  echo; echo "RESULTADO: APLICOU, mas com AVISOS (acima). Ex.: um indice unico nao foi criado por causa de duplicatas."
  echo "           Isso NAO impede o funcionamento; revise as duplicatas e crie o indice depois (o comando esta no aviso)."
  exit 3
fi
echo; echo "RESULTADO: OK - todas as migracoes aplicaram na copia, sem perder nenhuma linha e sem avisos."
exit 0
