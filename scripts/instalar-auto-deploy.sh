#!/usr/bin/env bash
# Instala a atualização automática no servidor: agenda scripts/auto-deploy.sh
# no cron do usuário atual, a cada 5 minutos. Pode rodar de novo sem duplicar.
set -euo pipefail

pasta="$(cd "$(dirname "$0")/.." && pwd)"
log="$HOME/casa-vo-sebastiana-deploy.log"
linha="*/5 * * * * cd '$pasta' && ./scripts/auto-deploy.sh >> '$log' 2>&1"

for cmd in git docker curl flock crontab; do
  command -v "$cmd" >/dev/null || { echo "Falta o comando '$cmd' no servidor."; exit 1; }
done

# Lê o agendamento atual antes de gravar, preservando as outras tarefas
atual=$(crontab -l 2>/dev/null || true)
{ if [ -n "$atual" ]; then grep -v 'scripts/auto-deploy.sh' <<<"$atual" || true; fi; echo "$linha"; } | crontab -

echo "Pronto. A cada 5 minutos o servidor confere se há versão nova com CI verde."
echo "Histórico das atualizações: $log"
