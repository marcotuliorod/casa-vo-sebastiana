#!/usr/bin/env bash
# Verificação periódica (cron, a cada 5 minutos): se o main do GitHub tiver uma
# versão nova com o CI verde, roda o deploy. Não precisa de chave nem de
# segredo no GitHub — o repositório é público e o servidor só lê.
#
# - Compara o main com a última versão publicada com sucesso (não com a pasta),
#   então um deploy que falhou é tentado de novo, no máximo MAX_TENTATIVAS vezes.
# - Avisa por e-mail (scripts/alerta.sh) quando o deploy falha ou o CI do main falha.
# - Não faz nada enquanto existir o arquivo de pausa (ver docs/operacao.md).
#
# Instalação: ./scripts/instalar-auto-deploy.sh (uma vez, no servidor)
set -euo pipefail

REPO="marcotuliorod/casa-vo-sebastiana"
MAX_TENTATIVAS=2
LOG="${DEPLOY_LOG:-$HOME/casa-vo-sebastiana-deploy.log}"

# Mantém o log com as últimas 2000 linhas (reescreve no mesmo arquivo, que o cron abre em modo append)
aparar_log() {
  [ -f "$LOG" ] || return 0
  [ "$(wc -l < "$LOG")" -gt 2500 ] || return 0
  tail -n 2000 "$LOG" > "$LOG.tmp" && cat "$LOG.tmp" > "$LOG" && rm -f "$LOG.tmp"
}

# Situação do CI de um commit: verde, pendente, falhou ou nenhum
situacao_ci() {
  local resposta
  resposta=$(curl -fsS --max-time 20 -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$REPO/commits/$1/check-runs?per_page=100") || { echo "erro"; return; }
  python3 -I -c '
import json, sys
d = json.load(sys.stdin)
runs = d.get("check_runs", [])
if d.get("total_count", 0) == 0 or not runs:
    print("nenhum")
elif any(r.get("status") != "completed" for r in runs):
    print("pendente")
elif all(r.get("conclusion") in ("success", "skipped", "neutral") for r in runs):
    print("verde")
else:
    print("falhou")
' <<<"$resposta" 2>/dev/null || echo "erro"
}

main() {
  source "$(dirname "$0")/comum.sh"
  cd "$PASTA_PROJETO"

  # Uma execução por vez (um deploy pode levar mais de 5 minutos)
  exec 9>"${TMPDIR:-/tmp}/casa-vo-sebastiana-deploy.lock"
  flock -n 9 || exit 0
  export DEPLOY_COM_TRAVA=1

  aparar_log
  [ -f "$ESTADO/pausado" ] && exit 0

  timeout 60 git fetch --quiet origin main || exit 0
  local alvo publicado
  alvo=$(git rev-parse origin/main)
  if [ ! -s "$ESTADO/publicado" ]; then
    git rev-parse HEAD > "$ESTADO/publicado" # primeira execução: o que está na pasta já está no ar
  fi
  publicado=$(cat "$ESTADO/publicado")
  [ "$alvo" = "$publicado" ] && exit 0

  local curto=${alvo:0:7} tentativas=0
  if [ -f "$ESTADO/falhas" ] && [ "$(cut -d' ' -f1 "$ESTADO/falhas")" = "$alvo" ]; then
    tentativas=$(cut -d' ' -f2 "$ESTADO/falhas")
  fi
  [ "$tentativas" -ge "$MAX_TENTATIVAS" ] && exit 0 # já avisou; espera a próxima versão

  case "$(situacao_ci "$alvo")" in
    verde) ;;
    falhou)
      if [ "$(cat "$ESTADO/aviso-ci" 2>/dev/null)" != "$alvo" ]; then
        echo "$(agora) $curto com CI falhando; não atualizo"
        echo "$alvo" > "$ESTADO/aviso-ci"
        ./scripts/alerta.sh "CI falhou: versão $curto não foi publicada" <<EOF
O CI (testes automáticos) falhou na versão $curto do main.
O site continua no ar na versão ${publicado:0:7}, sem mudanças.
EOF
      fi
      exit 0 ;;
    *) exit 0 ;; # CI rodando, sem checks ou GitHub fora do ar: tenta de novo depois
  esac

  tentativas=$((tentativas + 1))
  echo "$(agora) nova versão $curto com CI verde; atualizando (tentativa $tentativas de $MAX_TENTATIVAS)"
  if "${DEPLOY_CMD:-./scripts/deploy.sh}" 2>&1 | tee "$ESTADO/ultimo-deploy.log"; then
    rm -f "$ESTADO/falhas"
    exit 0
  fi

  echo "$alvo $tentativas" > "$ESTADO/falhas"
  echo "$(agora) deploy de $curto falhou (tentativa $tentativas de $MAX_TENTATIVAS)"
  local proximo="Vou tentar de novo em 5 minutos."
  [ "$tentativas" -ge "$MAX_TENTATIVAS" ] && proximo="Não vou tentar de novo sozinho até sair uma versão nova no main (ou até rodar ./scripts/deploy.sh no servidor)."
  {
    echo "O deploy da versão $curto falhou (tentativa $tentativas de $MAX_TENTATIVAS)."
    echo "$proximo"
    echo
    echo "Últimas linhas do deploy:"
    tail -n 40 "$ESTADO/ultimo-deploy.log"
  } | ./scripts/alerta.sh "Deploy falhou: versão $curto"
  exit 0
}

main "$@"; exit $?
