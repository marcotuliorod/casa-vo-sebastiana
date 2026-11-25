#!/usr/bin/env bash
# Volta o site para a versão anterior (a que estava no ar antes do último deploy)
# e pausa o deploy automático, para ele não publicar de novo a versão com problema.
#
# Uso, no servidor, dentro da pasta do projeto: ./scripts/rollback.sh
# Para retomar o deploy automático depois da correção: ver docs/operacao.md.
#
# Só troca a imagem do app; o banco fica como está (as migrations só acrescentam).
set -euo pipefail

main() {
  source "$(dirname "$0")/comum.sh"
  cd "$PASTA_PROJETO"

  exec 9>"${TMPDIR:-/tmp}/casa-vo-sebastiana-deploy.lock"
  flock -w 600 9 || { echo "Um deploy está em andamento há mais de 10 minutos; tente de novo."; exit 1; }

  local img
  img=$(imagem_app)
  if [ -z "$img" ] || ! docker image inspect "$img:anterior" >/dev/null 2>&1; then
    echo "Não há versão anterior guardada ($img:anterior). Nada foi alterado."
    exit 1
  fi

  touch "$ESTADO/pausado"
  echo "==> Deploy automático pausado"

  echo "==> Voltando o app para a versão anterior"
  docker tag "$img:anterior" "$img:latest"
  docker compose up -d --no-build --wait --wait-timeout 180 app

  echo "==> Pronto. O site está na versão anterior."
  ./scripts/alerta.sh "Site voltou para a versão anterior" <<EOF
O app foi voltado para a versão anterior com ./scripts/rollback.sh.
O deploy automático está pausado. Depois de corrigir o problema no GitHub, retome com:
rm $ESTADO/pausado
EOF
}

main "$@"; exit $?
