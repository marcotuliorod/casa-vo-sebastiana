# Operação do site — guia rápido

Comandos para o dia a dia do servidor. Todos rodam no servidor, na pasta do projeto:

```bash
ssh vps-deploy
```

```bash
cd ~/casa-vo-sebastiana
```

## O site está no ar?

```bash
curl -sI https://agenda.mtrm.tech | head -n 1
```

Deve responder `HTTP/2 200`. Para ver os containers:

```bash
docker compose ps
```

`app` e `postgres` devem aparecer como `(healthy)`.

## Quais foram as últimas atualizações?

```bash
tail -n 30 ~/casa-vo-sebastiana-deploy.log
```

Como o deploy automático funciona: [deploy-automatico.md](deploy-automatico.md).

## Uma atualização deu problema: voltar para a versão anterior

```bash
./scripts/rollback.sh
```

O script:

- pausa o deploy automático;
- volta o app para a versão que estava no ar antes do último deploy;
- manda um e-mail avisando.

O banco não é alterado. Depois que a correção estiver no `main` com o CI verde, retome o deploy
automático:

```bash
rm ~/.casa-vo-sebastiana-deploy/pausado
```

Só existe **uma** versão anterior guardada (a do deploy imediatamente anterior).

## Restaurar um backup

Os backups diários ficam no volume `backup_data` (15 dias) e são copiados para o Google Drive
às 04:00 (horário de Brasília), onde ficam por 30 dias (`~/bin/backup-offsite.sh` no servidor,
fora do repositório; log em `~/backup-offsite.log`). Detalhes no [README](../README.md#5-backups).

**Último ensaio de restauração:** 25/11/2026, com o dump `backup_20261125_162741.dump`,
restaurado num banco temporário pelo comando do passo 2. As contagens de agendamentos, clientes,
grade, médiuns e eventos bateram com produção. Repita o ensaio de tempos em tempos (a cada poucos
meses) e atualize esta linha.

Antes de restaurar, **pause o deploy automático**, para uma atualização não reiniciar o app no
meio da restauração:

```bash
touch ~/.casa-vo-sebastiana-deploy/pausado
```

1. Liste os dumps e escolha um:

   ```bash
   docker compose exec backup ls -lh /backups
   ```

2. Confira o dump num banco temporário (não mexe em produção). O container `backup` já tem os
   dumps e a senha do banco:

   ```bash
   docker compose exec -T backup sh -c 'createdb -h postgres -U "$POSTGRES_USER" restore_teste && pg_restore -h postgres -U "$POSTGRES_USER" -d restore_teste --no-owner /backups/backup_AAAAMMDD_HHMMSS.dump && psql -h postgres -U "$POSTGRES_USER" -d restore_teste -c "select count(*) from agendamentos"'
   ```

3. Só se for mesmo para substituir produção: pare o app e o cron, restaure, e suba de novo:

   ```bash
   docker compose stop app cron
   ```

   ```bash
   docker compose exec -T backup sh -c 'pg_restore -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /backups/backup_AAAAMMDD_HHMMSS.dump'
   ```

   ```bash
   docker compose start app cron
   ```

4. Apague o banco temporário e retome o deploy automático:

   ```bash
   docker compose exec -T backup sh -c 'dropdb -h postgres -U "$POSTGRES_USER" restore_teste'
   ```

   ```bash
   rm ~/.casa-vo-sebastiana-deploy/pausado
   ```

## Trocar uma senha ou chave do `.env`

Sempre guarde uma cópia **fora** da pasta do projeto antes de editar (a pasta é um repositório
público; cópias de `.env` lá dentro ficam ignoradas pelo git, mas não devem existir):

```bash
cp .env ~/env-backup-$(date +%Y%m%d)
```

| Variável | Como trocar | Efeito |
|---|---|---|
| `AUTH_SECRET` | gerar com `openssl rand -base64 32` | desconecta quem está no painel e invalida links de histórico abertos |
| `CRON_SECRET` | gerar com `openssl rand -hex 32` | nenhum (o cron lê do mesmo `.env`) |
| `RESEND_API_KEY` | criar nova chave no Resend (só envio), apagar a antiga | nenhum |
| `POSTGRES_PASSWORD` | trocar no Postgres **e** no `.env`, mantendo `DATABASE_URL` igual | exige cuidado; peça ajuda |

Depois de editar o `.env`, aplique:

```bash
docker compose up -d
```

E apague a cópia quando tudo estiver funcionando:

```bash
rm ~/env-backup-*
```

## Disco cheio

```bash
df -h /
```

```bash
docker system df
```

O deploy já apaga imagens soltas e cache de build com mais de 7 dias. Para liberar mais espaço
de cache de build (não apaga dados nem containers):

```bash
docker builder prune -f
```

Os volumes (`pgdata`, `backup_data`) **nunca** devem ser apagados.

## Alertas por e-mail

O servidor manda e-mail para `ADMIN_EMAIL_NOTIFICACOES` quando:

- um deploy falha (com o motivo);
- o CI do `main` falha;
- o site é voltado para a versão anterior;
- o monitor (a cada 15 minutos) encontra um problema: site fora do ar, banco sem responder,
  container parado ou disco acima de 90%. Chega um e-mail quando o problema começa e outro
  quando ele é resolvido;
- todo dia às 08:00 (Brasília): **resumo diário** com a versão no ar, os backups (no servidor e
  no Google Drive), o uso do disco, e-mails que falharam e agendamentos novos. Quando algo
  precisa de atenção, o assunto começa com "ATENÇÃO".

Os alertas não pegam uma queda do servidor inteiro (se a VPS desligar, ela não consegue
avisar). Nesse caso o sinal é **não chegar** o resumo diário.

Histórico do monitor:

```bash
tail -n 30 ~/casa-vo-sebastiana-saude.log
```

Rodar o monitor ou o resumo na hora:

```bash
./scripts/saude.sh verificar
```

```bash
./scripts/saude.sh resumo
```

Para testar o envio:

```bash
./scripts/alerta.sh "Teste de alerta" <<< "Se chegou, os alertas funcionam."
```
