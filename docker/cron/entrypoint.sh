#!/bin/sh
set -e
touch /var/log/cron.log
crond -f -l 2
