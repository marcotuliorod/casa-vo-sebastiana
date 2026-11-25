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
que o CI termina.

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
| Versão nova, CI falhou | Não atualiza (anota no log) |
| Versão nova, CI verde | Roda `scripts/deploy.sh` |

`scripts/deploy.sh` baixa o `main` (só avança; se houver mudança local na pasta do servidor,
para com erro), reconstrói as imagens, aplica as migrations **antes** de trocar o app, sobe a
nova versão esperando o healthcheck e apaga imagens antigas. Se algum passo falhar, para ali e
o site continua na versão anterior.

## Requisitos no servidor

`git`, `docker`, `curl`, `flock` e `crontab` (o instalador confere e avisa se faltar algum).
O usuário precisa conseguir rodar `git fetch` e `docker compose` sem senha nem `sudo`.

## Conferir depois de uma atualização

Quando o log mostrar `Deploy concluído`, confirme que o site está no ar e que o cabeçalho de
segurança continua sendo aplicado:

```bash
curl -sI https://agenda.mtrm.tech | grep -iE '^(HTTP|content-security-policy)'
```

Deve aparecer `HTTP/2 200` e `content-security-policy` (sem o sufixo `-report-only`).

## Desligar

```bash
crontab -l | grep -v 'scripts/auto-deploy.sh' | crontab -
```
