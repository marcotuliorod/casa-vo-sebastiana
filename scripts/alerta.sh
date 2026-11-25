#!/usr/bin/env bash
# Envia um e-mail de alerta para a Casa usando o Resend já configurado no .env
# (RESEND_API_KEY, EMAIL_FROM e ADMIN_EMAIL_NOTIFICACOES).
#
# Uso: ./scripts/alerta.sh "Assunto" <<< "texto do alerta"
#      (o corpo vem da entrada padrão; se não vier nada, usa só o assunto)
#
# Nunca faz o script que chamou falhar: se o envio der errado, só registra no log.
set -uo pipefail
source "$(dirname "$0")/comum.sh"

assunto="[Casa de Vó Sebastiana] ${1:-Alerta do servidor}"
corpo=""
if [ ! -t 0 ]; then corpo=$(cat); fi
[ -n "$corpo" ] || corpo="${1:-Alerta do servidor}"
corpo="$corpo

Servidor: $(hostname) · $(agora)"

chave=$(ler_env RESEND_API_KEY)
de=$(ler_env EMAIL_FROM)
para=$(ler_env ADMIN_EMAIL_NOTIFICACOES)

if [ -z "$chave" ] || [ -z "$de" ] || [ -z "$para" ]; then
  echo "$(agora) alerta não enviado (falta RESEND_API_KEY, EMAIL_FROM ou ADMIN_EMAIL_NOTIFICACOES): $assunto" >&2
  exit 0
fi

# Monta o JSON com python3 (escapa aspas, acentos e quebras de linha corretamente)
json=$(ASSUNTO="$assunto" CORPO="$corpo" DE="$de" PARA="$para" python3 -I -c '
import json, os
para = [e.strip() for e in os.environ["PARA"].split(",") if e.strip()]
print(json.dumps({"from": os.environ["DE"], "to": para,
                  "subject": os.environ["ASSUNTO"], "text": os.environ["CORPO"]}))
')

if curl -fsS --max-time 20 -o /dev/null \
    -H "Authorization: Bearer $chave" -H 'Content-Type: application/json' \
    -d "$json" https://api.resend.com/emails; then
  echo "$(agora) alerta enviado: $assunto"
else
  echo "$(agora) falha ao enviar o alerta: $assunto" >&2
fi
exit 0
