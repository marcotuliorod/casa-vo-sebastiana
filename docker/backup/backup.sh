#!/bin/sh
set -e

BACKUP_DIR=/backups
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

while true; do
  timestamp=$(date +%Y%m%d_%H%M%S)
  dest="$BACKUP_DIR/backup_${timestamp}.dump"

  echo "[backup] Iniciando dump em $dest"
  if pg_dump --format=custom \
      --host="$POSTGRES_HOST" \
      --port="${POSTGRES_PORT:-5432}" \
      --username="$POSTGRES_USER" \
      --dbname="$POSTGRES_DB" \
      --file="$dest"; then
    echo "[backup] OK: $dest"
  else
    echo "[backup] FALHOU: $dest" >&2
  fi

  find "$BACKUP_DIR" -name 'backup_*.dump' -mtime "+${RETENTION_DAYS}" -delete

  sleep 86400
done
