#!/usr/bin/env bash
# Atualiza o site no servidor: baixa o main, reconstrói, aplica migrations e
# sobe a nova versão esperando o app ficar saudável.
#
# Roda no servidor, dentro da pasta do projeto. Chamado por scripts/auto-deploy.sh
# quando o main tem versão nova com CI verde, mas também pode ser rodado à mão:
# ./scripts/deploy.sh
set -euo pipefail

echo "==> Baixando a versão nova do main"
git fetch --quiet origin main
git merge --ff-only origin/main

echo "==> Construindo as imagens"
docker compose build

# Migrations antes de trocar o app: o código novo já encontra o banco atualizado.
echo "==> Aplicando migrations"
docker compose run --rm migrate

echo "==> Subindo a nova versão (aguarda o healthcheck)"
docker compose up -d --wait --wait-timeout 180

echo "==> Limpando imagens antigas"
docker image prune -f >/dev/null

echo "==> Deploy concluído: $(git log -1 --format='%h %s')"
