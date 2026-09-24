#!/bin/sh
# Backup automatico do PostgreSQL. Roda no container "backup" dos composes (docker-compose.vm.yml / prod.yml):
# a cada BACKUP_INTERVAL_SECONDS (padrao: 1 dia) gera um dump comprimido em /backups e apaga os mais antigos
# que BACKUP_KEEP_DAYS dias (padrao: 14). Cada dump e' conferido (pg_restore --list) antes de valer.
#
# Uma vez so' (util pra testar):  BACKUP_ONCE=1 sh scripts/backup-loop.sh
# Restaurar: veja DEPLOY.md ("Backup automatico do banco").
#
# ATENCAO: o backup fica na MESMA maquina do banco. Copie a pasta ./backups para fora dela
# (outro disco, nuvem) - se a maquina se perder, o backup local se perde junto.
set -u

HOST="${PGHOST:-postgres}"
USUARIO="${PGUSER:-mbd}"
BANCO="${PGDATABASE:-meu_bolso_digital}"
DIR="${BACKUP_DIR:-/backups}"
MANTER_DIAS="${BACKUP_KEEP_DAYS:-14}"
INTERVALO="${BACKUP_INTERVAL_SECONDS:-86400}"

mkdir -p "$DIR"

fazer_backup() {
  arquivo="$DIR/mbd-$(date +%Y-%m-%d-%H%M%S).dump"
  if pg_dump -h "$HOST" -U "$USUARIO" -d "$BANCO" -Fc -f "$arquivo.tmp" && pg_restore --list "$arquivo.tmp" >/dev/null 2>&1; then
    mv "$arquivo.tmp" "$arquivo"
    echo "[backup] OK: $arquivo ($(wc -c < "$arquivo") bytes)"
  else
    rm -f "$arquivo.tmp"
    echo "[backup] FALHOU ao gerar $arquivo" >&2
    return 1
  fi
  # retencao: apaga backups mais antigos que MANTER_DIAS dias
  find "$DIR" -name 'mbd-*.dump' -type f -mtime +"$MANTER_DIAS" -print -delete | sed 's/^/[backup] removido (antigo): /'
  return 0
}

if [ "${BACKUP_ONCE:-0}" = "1" ]; then
  fazer_backup
  exit $?
fi

# espera o banco terminar de subir e entra no ciclo diario
sleep "${BACKUP_FIRST_DELAY_SECONDS:-60}"
while true; do
  fazer_backup || true
  sleep "$INTERVALO"
done
