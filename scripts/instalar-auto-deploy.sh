#!/usr/bin/env bash
# Instala as tarefas do servidor no cron do usuário atual. Pode rodar de novo sem duplicar.
#   - scripts/auto-deploy.sh   a cada 5 min: publica versão nova do main com CI verde
#   - scripts/saude.sh         a cada 15 min: alerta se o site, o banco ou o disco tiverem problema
#   - scripts/saude.sh resumo  todo dia às 08:00 (Brasília): resumo de saúde por e-mail
set -euo pipefail

pasta="$(cd "$(dirname "$0")/.." && pwd)"
log="$HOME/casa-vo-sebastiana-deploy.log"
log_saude="$HOME/casa-vo-sebastiana-saude.log"
linhas="*/5 * * * * cd '$pasta' && ./scripts/auto-deploy.sh >> '$log' 2>&1
*/15 * * * * cd '$pasta' && ./scripts/saude.sh verificar >> '$log_saude' 2>&1
0 11 * * * cd '$pasta' && ./scripts/saude.sh resumo >> '$log_saude' 2>&1"

for cmd in git docker curl flock crontab python3 timeout; do
  command -v "$cmd" >/dev/null || { echo "Falta o comando '$cmd' no servidor."; exit 1; }
done

source "$pasta/scripts/comum.sh"
for var in RESEND_API_KEY EMAIL_FROM ADMIN_EMAIL_NOTIFICACOES; do
  [ -n "$(ler_env "$var")" ] || echo "Aviso: $var está vazio no .env; os alertas por e-mail não serão enviados."
done

# Lê o agendamento atual antes de gravar, preservando as outras tarefas
atual=$(crontab -l 2>/dev/null || true)
{ if [ -n "$atual" ]; then grep -vE 'scripts/(auto-deploy|saude)\.sh' <<<"$atual" || true; fi; echo "$linhas"; } | crontab -

echo "Pronto. A cada 5 minutos o servidor confere se há versão nova com CI verde."
echo "Histórico das atualizações: $log"
echo "Monitor de saúde a cada 15 minutos e resumo diário às 08:00 (Brasília)."
echo "Alertas e resumo chegam por e-mail para ADMIN_EMAIL_NOTIFICACOES."
