#!/bin/sh
# Backup diário do Postgres com pg_dump (formato custom).
#
# - Roda todo dia às 03:00 America/Sao_Paulo (06:00 UTC; o Brasil não tem
#   horário de verão desde 2019). Ajustável por BACKUP_HOUR_UTC.
# - No primeiro start do container, faz um dump imediato só se não houver
#   nenhum dump das últimas 24h (evita dump extra a cada restart/deploy).
# - O dump é gravado num arquivo .tmp e só é renomeado para .dump se o
#   pg_dump terminar com sucesso; em falha o arquivo parcial é apagado.
# - Retenção: apaga dumps com mais de RETENTION_DAYS dias.
#
# Uso manual (um dump agora, sem loop):
#   docker compose exec backup sh /backup.sh --once
set -u

BACKUP_DIR=${BACKUP_DIR:-/backups}
RETENTION_DAYS=${RETENTION_DAYS:-14}
BACKUP_HOUR_UTC=${BACKUP_HOUR_UTC:-6}

log() { echo "[backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }
err() { echo "[backup] $(date -u '+%Y-%m-%dT%H:%M:%SZ') ERRO: $*" >&2; }

# Segundos até o próximo BACKUP_HOUR_UTC:00:00 UTC. Usa só aritmética sobre o
# epoch (que em UTC tem dias de exatamente 86400s), sem depender do parser de
# datas do busybox. Nunca retorna 0: se for exatamente a hora, espera 24h.
seconds_until_next_run() {
  now=${1:-$(date -u +%s)}
  target=$((BACKUP_HOUR_UTC * 3600))
  sod=$((now % 86400))
  delay=$(((target - sod + 86400) % 86400))
  [ "$delay" -eq 0 ] && delay=86400
  echo "$delay"
}

run_backup() {
  timestamp=$(date -u +%Y%m%d_%H%M%S)
  dest="$BACKUP_DIR/backup_${timestamp}.dump"
  tmp="$dest.tmp"

  log "Iniciando dump em $dest"
  if pg_dump --format=custom \
      --host="$POSTGRES_HOST" \
      --port="${POSTGRES_PORT:-5432}" \
      --username="$POSTGRES_USER" \
      --dbname="$POSTGRES_DB" \
      --file="$tmp"; then
    mv "$tmp" "$dest"
    log "OK: $dest ($(du -h "$dest" | cut -f1))"
    status=0
  else
    rm -f "$tmp" "$dest"
    err "pg_dump falhou; dump parcial removido. Nenhum backup gerado neste ciclo."
    status=1
  fi

  find "$BACKUP_DIR" -name 'backup_*.dump' -mtime "+${RETENTION_DAYS}" -delete
  return "$status"
}

# Existe algum dump não vazio das últimas 24h?
has_recent_backup() {
  [ -n "$(find "$BACKUP_DIR" -name 'backup_*.dump' -size +0 -mmin -1440 2>/dev/null | head -n 1)" ]
}

trap 'log "Encerrando."; exit 0' TERM INT

mkdir -p "$BACKUP_DIR"
# Restos de um dump interrompido (ex.: container morto no meio do pg_dump).
find "$BACKUP_DIR" -name 'backup_*.dump.tmp' -delete

if [ "${1:-}" = "--once" ]; then
  run_backup
  exit $?
fi

if has_recent_backup; then
  log "Já existe dump das últimas 24h; pulando o dump inicial."
else
  log "Nenhum dump das últimas 24h; fazendo dump inicial."
  run_backup || true
fi

while true; do
  delay=$(seconds_until_next_run)
  log "Próximo dump em ${delay}s (todo dia às $(printf '%02d' "$BACKUP_HOUR_UTC"):00 UTC)."
  # sleep em background + wait: o shell roda como PID 1 no container e só
  # trata o SIGTERM do `docker stop` se não estiver bloqueado num sleep.
  sleep "$delay" &
  wait $!
  run_backup || true
done
