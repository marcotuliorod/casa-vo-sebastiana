#!/bin/sh
set -e
# exec: o crond vira o processo principal e a saída dos jobs aparece em `docker compose logs cron`
exec crond -f -l 2
