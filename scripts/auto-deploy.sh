#!/usr/bin/env bash
# Verificação periódica (cron, a cada 5 minutos): se o main do GitHub tiver uma
# versão nova com o CI verde, roda o deploy. Não precisa de chave nem de
# segredo no GitHub — o repositório é público e o servidor só lê.
#
# Instalação: ./scripts/instalar-auto-deploy.sh (uma vez, no servidor)
set -euo pipefail

cd "$(dirname "$0")/.."
REPO="marcotuliorod/casa-vo-sebastiana"

# Uma execução por vez (um deploy pode levar mais de 5 minutos)
exec 9>"${TMPDIR:-/tmp}/casa-vo-sebastiana-deploy.lock"
flock -n 9 || exit 0

git fetch --quiet origin main
local_sha=$(git rev-parse HEAD)
remoto_sha=$(git rev-parse origin/main)
[ "$local_sha" = "$remoto_sha" ] && exit 0

# Só atualiza se todos os checks do commit terminaram com sucesso
checks=$(curl -fsS -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$REPO/commits/$remoto_sha/check-runs") || {
  echo "$(date -Is) não consegui consultar o CI de ${remoto_sha:0:7}; tento de novo depois"
  exit 0
}
# conta ocorrências sem que "nenhuma" vire erro (set -e + pipefail)
contar() { { grep -Eo "$1" <<<"$checks" || true; } | wc -l; }
total=$({ grep -Eo '"total_count": *[0-9]+' <<<"$checks" || true; } | grep -Eo '[0-9]+$' || echo 0)
pendentes=$(contar '"status": *"(queued|in_progress|waiting|requested|pending)"')
sucessos=$(contar '"conclusion": *"(success|skipped|neutral)"')

if [ "${total:-0}" -eq 0 ] || [ "$pendentes" -gt 0 ]; then
  exit 0 # CI ainda não rodou ou não terminou
fi
if [ "$sucessos" -ne "$total" ]; then
  echo "$(date -Is) ${remoto_sha:0:7} com CI falhando; não atualizo"
  exit 0
fi

echo "$(date -Is) nova versão ${remoto_sha:0:7} com CI verde; atualizando"
./scripts/deploy.sh
