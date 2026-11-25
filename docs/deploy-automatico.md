# Atualização automática do site — configuração única

Depois desta configuração, **o servidor se atualiza sozinho**: a cada 5 minutos ele confere se
o `main` do GitHub tem uma versão nova com o CI verde e, se tiver, roda `scripts/deploy.sh`.
Não precisa de chave, senha nem acesso de administrador ao GitHub — o repositório é público e o
servidor só lê.

Precisa ser feito **uma vez**, por quem tem acesso ao servidor. Leva uns 5 minutos.

## Passo a passo

Entre no servidor (SSH) com o usuário que hoje roda o `docker compose` do projeto e execute,
um de cada vez:

```bash
cd ~/casa-vo-sebastiana
```

(ajuste o caminho se o projeto estiver em outra pasta)

```bash
git pull --ff-only
```

```bash
./scripts/deploy.sh
```

Este primeiro deploy já coloca no ar tudo o que estava pendente. Ele reconstrói as imagens,
aplica as migrations e sobe a nova versão — leva alguns minutos e termina com
`Deploy concluído`.

```bash
./scripts/instalar-auto-deploy.sh
```

Pronto. A partir daqui, cada mudança aprovada no GitHub entra no ar em até ~5 minutos depois
que o CI termina. O mesmo instalador agenda o monitor de saúde (a cada 15 minutos) e o resumo
diário por e-mail; ver [operacao.md](operacao.md#alertas-por-e-mail).

## Como acompanhar

O histórico das atualizações fica em `~/casa-vo-sebastiana-deploy.log`:

```bash
tail -n 50 ~/casa-vo-sebastiana-deploy.log
```

## O que acontece em cada caso

| Situação no GitHub | O que o servidor faz |
|--------------------|----------------------|
| Nada novo no `main` | Nada |
| Versão nova, CI ainda rodando | Espera a próxima verificação |
| Versão nova, CI falhou | Não atualiza; anota no log e manda **um** e-mail de aviso |
| Versão nova, CI verde | Roda `scripts/deploy.sh` |
| O deploy falhou | Manda e-mail com o motivo e tenta de novo 5 minutos depois (no máximo 2 tentativas por versão) |
| Deploy automático pausado | Nada (ver [operacao.md](operacao.md)) |

O servidor compara o `main` com a **última versão publicada com sucesso** (guardada em
`~/.casa-vo-sebastiana-deploy/publicado`), não com a pasta do projeto. Por isso um deploy que
falhou no meio é tentado de novo.

`scripts/deploy.sh`, em ordem:

1. baixa o `main` (só avança; se houver mudança local na pasta do servidor, para com erro);
2. guarda a imagem do app que está no ar como `:anterior`;
3. reconstrói as imagens do app, do cron **e das migrations**;
4. faz um backup do banco;
5. aplica as migrations **antes** de trocar o app;
6. sobe a nova versão esperando o healthcheck;
7. apaga imagens e cache de build antigos.

Se um dos passos 1 a 5 falhar, o site continua na versão anterior, sem mudanças. Se a nova
versão não ficar saudável no passo 6, o script **volta sozinho o app para a imagem `:anterior`**
e avisa por e-mail. As migrations aplicadas ficam (elas só acrescentam, então a versão anterior
continua funcionando).

Para voltar manualmente para a versão anterior, use `./scripts/rollback.sh` — ver
[operacao.md](operacao.md).

## Requisitos no servidor

`git`, `docker`, `curl`, `flock`, `crontab`, `python3` e `timeout` (o instalador confere e avisa
se faltar algum). Os alertas usam `RESEND_API_KEY`, `EMAIL_FROM` e `ADMIN_EMAIL_NOTIFICACOES`
do `.env`.
O usuário precisa conseguir rodar `git fetch` e `docker compose` sem senha nem `sudo`.

## Conferir depois de uma atualização

Quando o log mostrar `Deploy concluído`, confirme que o site está no ar e que o cabeçalho de
segurança continua sendo aplicado:

```bash
curl -sI https://agenda.mtrm.tech | grep -iE '^(HTTP|content-security-policy)'
```

Deve aparecer `HTTP/2 200` e `content-security-policy` (sem o sufixo `-report-only`).

## Pausar ou desligar

Pausar (por exemplo, durante uma restauração de backup) e retomar:

```bash
touch ~/.casa-vo-sebastiana-deploy/pausado
```

```bash
rm ~/.casa-vo-sebastiana-deploy/pausado
```

Desligar de vez:

```bash
crontab -l | grep -v 'scripts/auto-deploy.sh' | crontab -
```
