#!/usr/bin/env bash
# Atualiza o site no servidor: baixa o main, reconstrói as imagens (inclusive a das
# migrations), faz um backup, aplica as migrations e sobe a nova versão esperando o
# app ficar saudável. Se a nova versão não subir, volta sozinho para a anterior.
#
# Roda no servidor, dentro da pasta do projeto. Chamado por scripts/auto-deploy.sh
# quando o main tem versão nova com CI verde, mas também pode ser rodado à mão:
# ./scripts/deploy.sh
#
# Todo o script fica dentro de main(): o bash lê a função inteira antes de executar,
# então o `git merge` abaixo pode trocar este arquivo sem atrapalhar a execução.
set -euo pipefail

main() {
  source "$(dirname "$0")/comum.sh"
  cd "$PASTA_PROJETO"

  # Uma execução por vez. O auto-deploy já segura a trava e avisa por DEPLOY_COM_TRAVA.
  if [ -z "${DEPLOY_COM_TRAVA:-}" ]; then
    exec 9>"${TMPDIR:-/tmp}/casa-vo-sebastiana-deploy.lock"
    flock -n 9 || { echo "Outro deploy está em andamento; tente de novo em alguns minutos."; exit 1; }
  fi

  echo "==> Baixando a versão nova do main"
  timeout 120 git fetch --quiet origin main
  git merge --ff-only origin/main

  local img
  img=$(imagem_app)
  if [ -n "$img" ] && docker image inspect "$img:latest" >/dev/null 2>&1; then
    echo "==> Guardando a versão no ar como $img:anterior (para voltar, se precisar)"
    docker tag "$img:latest" "$img:anterior"
  fi

  echo "==> Construindo as imagens (app, cron e migrations)"
  docker compose --profile tools build

  echo "==> Backup do banco antes das migrations"
  docker compose exec -T backup sh /backup.sh --once

  # Migrations antes de trocar o app: o código novo já encontra o banco atualizado.
  echo "==> Aplicando migrations"
  docker compose run --rm migrate

  echo "==> Subindo a nova versão (aguarda o healthcheck)"
  if ! docker compose up -d --wait --wait-timeout 180; then
    echo "!!! A nova versão não ficou saudável."
    if [ -n "$img" ] && docker image inspect "$img:anterior" >/dev/null 2>&1; then
      echo "==> Voltando o app para a versão anterior"
      docker tag "$img:anterior" "$img:latest"
      docker compose up -d --no-build --wait --wait-timeout 180 app \
        && echo "==> O site voltou para a versão anterior." \
        || echo "!!! Não consegui voltar para a versão anterior; o site pode estar fora do ar."
    fi
    exit 1
  fi

  git rev-parse HEAD > "$ESTADO/publicado"

  echo "==> Limpando imagens e cache de build antigos"
  docker image prune -f >/dev/null
  docker builder prune -f --filter until=168h >/dev/null || true

  echo "==> Deploy concluído: $(git log -1 --format='%h %s')"
}

main "$@"; exit $?
