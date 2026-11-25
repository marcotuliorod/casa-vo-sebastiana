#!/usr/bin/env bash
# Monitor do servidor, agendado por scripts/instalar-auto-deploy.sh.
#
#   ./scripts/saude.sh verificar   (a cada 15 min) site, banco, containers e disco;
#                                   manda e-mail só quando algo quebra e quando volta ao normal
#   ./scripts/saude.sh resumo      (1x por dia) e-mail com o resumo de saúde: versão no ar,
#                                   backups local e no Google Drive, disco, e-mails com falha
#
# Não alerta durante um deploy (o app reinicia por alguns segundos).
set -uo pipefail

LIMITE_DISCO=90       # % de uso do disco que gera alerta
LIMITE_BACKUP_MIN=1560 # 26 h: backup mais velho que isso é problema

main() {
  source "$(dirname "$0")/comum.sh"
  cd "$PASTA_PROJETO"
  aparar_log "$HOME/casa-vo-sebastiana-saude.log"
  case "${1:-}" in
    verificar) verificar ;;
    resumo) resumo ;;
    *) echo "Uso: $0 verificar|resumo"; exit 1 ;;
  esac
}

url_site() {
  local u
  u=$(ler_env AUTH_URL)
  [ -n "$u" ] || u=$(ler_env NEXT_PUBLIC_BASE_URL)
  printf '%s' "${u%/}"
}

deploy_em_andamento() {
  exec 8>"${TMPDIR:-/tmp}/casa-vo-sebastiana-deploy.lock"
  if flock -n 8; then flock -u 8; exec 8>&-; return 1; fi
  exec 8>&-
  return 0
}

uso_disco() { df -P / | awk 'NR==2 { gsub("%", "", $5); print $5 }'; }

psql_valor() {
  docker compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\"" 2>/dev/null | tr -d '[:space:]'
}

# Lista de problemas (uma linha cada); vazia quando está tudo bem
problemas() {
  local url status servico saude estado disco
  url=$(url_site)
  if ! curl -fsS --max-time 15 -o /dev/null "$url/api/health?deep=1"; then
    echo "O site não respondeu ($url/api/health?deep=1): fora do ar ou sem acesso ao banco."
  fi
  for servico in app postgres cron backup; do
    status=$(docker compose ps --format '{{.Health}} {{.State}}' "$servico" 2>/dev/null | head -n 1)
    saude=${status%% *}
    estado=${status##* }
    if [ "$estado" != "running" ]; then
      echo "O container '$servico' não está rodando (${estado:-não encontrado})."
    elif [ -n "$saude" ] && [ "$saude" != "$estado" ] && [ "$saude" != "healthy" ]; then
      echo "O container '$servico' está '$saude'."
    fi
  done
  disco=$(uso_disco)
  if [ "${disco:-0}" -ge "$LIMITE_DISCO" ]; then
    echo "Disco do servidor com ${disco}% de uso (ver docs/operacao.md, \"Disco cheio\")."
  fi
}

verificar() {
  deploy_em_andamento && exit 0

  local agora_problemas anterior
  agora_problemas=$(problemas)
  if [ -n "$agora_problemas" ]; then
    sleep 60 # confirma antes de alertar (evita alarme falso por oscilação)
    deploy_em_andamento && exit 0
    agora_problemas=$(problemas)
  fi

  anterior=$(cat "$ESTADO/saude" 2>/dev/null || echo "ok")
  if [ -z "$agora_problemas" ]; then
    if [ "$anterior" != "ok" ]; then
      echo "$(agora) voltou ao normal"
      ./scripts/alerta.sh "Site voltou ao normal" <<< "O problema anterior foi resolvido. Tudo funcionando."
    fi
    echo "ok" > "$ESTADO/saude"
    return 0
  fi

  if [ "$anterior" != "$agora_problemas" ]; then
    echo "$(agora) problema: $agora_problemas"
    ./scripts/alerta.sh "Problema no site" <<EOF
O monitor do servidor encontrou:

$agora_problemas

Guia: docs/operacao.md no repositório.
EOF
  fi
  printf '%s\n' "$agora_problemas" > "$ESTADO/saude"
}

resumo() {
  local atencao=() linhas=() url disco publicado ultimo recentes offsite_fim offsite_quando idade_h
  url=$(url_site)

  # Site e containers
  local p
  p=$(problemas)
  if [ -z "$p" ]; then linhas+=("Site: no ar, banco respondendo, containers saudáveis.")
  else linhas+=("Site: PROBLEMA"$'\n'"$p"); atencao+=("site"); fi

  # Versão publicada e deploy automático
  publicado=$(cat "$ESTADO/publicado" 2>/dev/null || git rev-parse HEAD)
  linhas+=("Versão no ar: $(git log -1 --format='%h %s (%cd)' --date=format:'%d/%m %H:%M' "$publicado" 2>/dev/null)")
  [ -f "$ESTADO/pausado" ] && { linhas+=("Deploy automático: PAUSADO"); atencao+=("deploy pausado"); }
  if [ -f "$ESTADO/falhas" ]; then
    linhas+=("Deploy automático: a versão $(cut -c1-7 "$ESTADO/falhas") falhou $(cut -d' ' -f2 "$ESTADO/falhas") vez(es)")
    atencao+=("deploy com falha")
  fi

  # Backup local (container backup)
  ultimo=$(docker compose exec -T backup sh -c 'ls -t /backups/backup_*.dump 2>/dev/null | head -n 1' 2>/dev/null | tr -d '\r')
  recentes=$(docker compose exec -T backup sh -c "find /backups -name 'backup_*.dump' -size +0 -mmin -$LIMITE_BACKUP_MIN | wc -l" 2>/dev/null | tr -d '[:space:]')
  if [ "${recentes:-0}" -gt 0 ]; then
    linhas+=("Backup no servidor: ok (último: ${ultimo##*/})")
  else
    linhas+=("Backup no servidor: NENHUM nas últimas 26 h (último: ${ultimo:-nenhum})"); atencao+=("backup local")
  fi

  # Cópia para o Google Drive (~/bin/backup-offsite.sh)
  offsite_fim=$(grep -E '^=== .* fim \(exit=' "$HOME/backup-offsite.log" 2>/dev/null | tail -n 1)
  if [ -z "$offsite_fim" ]; then
    linhas+=("Backup no Google Drive: sem registro em ~/backup-offsite.log"); atencao+=("backup offsite")
  else
    offsite_quando=$(awk '{print $2}' <<<"$offsite_fim")
    idade_h=$(( ( $(date -u +%s) - $(date -u -d "$offsite_quando" +%s 2>/dev/null || echo 0) ) / 3600 ))
    if [[ "$offsite_fim" == *"exit=0)"* ]] && [ "$idade_h" -le 26 ]; then
      linhas+=("Backup no Google Drive: ok (há ${idade_h} h)")
    else
      linhas+=("Backup no Google Drive: PROBLEMA ($offsite_fim)"); atencao+=("backup offsite")
    fi
  fi

  # Disco
  disco=$(uso_disco)
  linhas+=("Disco: ${disco}% usado")
  [ "${disco:-0}" -ge "$LIMITE_DISCO" ] && atencao+=("disco")

  # E-mails e movimento das últimas 24 h
  local falhos pendentes novos
  falhos=$(psql_valor "select count(*) from email_queue where status = 'falhou' and criado_em > now() - interval '24 hours'")
  pendentes=$(psql_valor "select count(*) from email_queue where status = 'pendente'")
  novos=$(psql_valor "select count(*) from agendamentos where criado_em > now() - interval '24 hours'")
  linhas+=("E-mails que desistiram de enviar (24 h): ${falhos:-?} · aguardando reenvio: ${pendentes:-?}")
  [ "${falhos:-0}" != "0" ] && atencao+=("e-mails com falha")
  linhas+=("Agendamentos e inscrições novos (24 h): ${novos:-?}")

  local assunto="Resumo diário: tudo certo"
  if [ "${#atencao[@]}" -gt 0 ]; then
    assunto="Resumo diário: ATENÇÃO ($(IFS=,; echo "${atencao[*]}" | sed 's/,/, /g'))"
  fi
  echo "$(agora) $assunto"
  printf '%s\n\n' "${linhas[@]}" | ./scripts/alerta.sh "$assunto"
}

main "$@"; exit $?
