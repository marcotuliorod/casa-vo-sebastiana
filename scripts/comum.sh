#!/usr/bin/env bash
# Funções compartilhadas pelos scripts do servidor (deploy, alerta, rollback).
# Uso: source "$(dirname "$0")/comum.sh"

# Pasta do projeto (onde estão o .env e o docker-compose.yml)
PASTA_PROJETO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Estado do deploy automático: fora do repositório, para não virar "mudança local".
ESTADO="${DEPLOY_ESTADO:-$HOME/.casa-vo-sebastiana-deploy}"
mkdir -p "$ESTADO"

# Lê uma variável do .env do projeto sem executar o arquivo (aceita aspas simples ou duplas).
ler_env() {
  local nome="$1" linha valor
  linha=$(grep -E "^${nome}=" "$PASTA_PROJETO/.env" 2>/dev/null | tail -n 1) || true
  valor="${linha#*=}"
  if [[ "$valor" =~ ^\"(.*)\"$ ]] || [[ "$valor" =~ ^\'(.*)\'$ ]]; then
    valor="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$valor"
}

# Nome da imagem do app gerada pelo Compose (ex.: casa-vo-sebastiana-app).
# Lido da configuração em JSON: `config --images app` também lista as dependências, em ordem variável.
imagem_app() {
  (cd "$PASTA_PROJETO" && docker compose config --format json 2>/dev/null) | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
print(d["services"]["app"].get("image") or (d["name"] + "-app"))
' 2>/dev/null
}

# Mantém um log com as últimas 2000 linhas. Reescreve no mesmo arquivo (o cron o abre em modo
# append), então a escrita em andamento continua no lugar certo.
aparar_log() {
  local log="$1"
  [ -f "$log" ] || return 0
  [ "$(wc -l < "$log")" -gt 2500 ] || return 0
  tail -n 2000 "$log" > "$log.tmp" && cat "$log.tmp" > "$log" && rm -f "$log.tmp"
}

agora() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
