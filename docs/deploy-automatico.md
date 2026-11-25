# Deploy automático — configuração única

Depois desta configuração, **todo merge no `main` com CI verde atualiza o site sozinho**
(workflow `.github/workflows/deploy.yml`, que entra no servidor por SSH e roda
`scripts/deploy.sh`). Enquanto ela não for feita, o workflow só mostra um aviso e não faz nada.

Precisa ser feito uma vez, por quem tem acesso ao servidor e às configurações do repositório
no GitHub. Leva uns 10 minutos.

## 1. No servidor: criar uma chave só para o deploy

Entre no servidor com o usuário que hoje roda o `docker compose` do projeto e execute:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions-deploy"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy
```

O último comando mostra a **chave privada** (de `-----BEGIN OPENSSH PRIVATE KEY-----` até
`-----END OPENSSH PRIVATE KEY-----`). Copie tudo — ela vai no passo 3 e não deve ir para nenhum
outro lugar. Depois, pode apagar o arquivo: `rm ~/.ssh/github_deploy`.

Confira também, ainda no servidor:

```bash
cd ~/casa-vo-sebastiana          # pasta do projeto (ajuste se for outra)
git fetch origin main            # precisa funcionar sem pedir senha
docker compose ps                # precisa funcionar sem sudo
```

## 2. No seu computador: a "impressão digital" do servidor

Isso garante que o GitHub está falando com o servidor certo. Rode (troque pelo endereço real):

```bash
ssh-keyscan -p 22 ENDERECO_DO_SERVIDOR
```

Copie todas as linhas da saída.

## 3. No GitHub: cadastrar os segredos

No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
Cadastre um por um:

| Nome | Valor |
|------|-------|
| `DEPLOY_HOST` | Endereço do servidor (IP ou domínio) |
| `DEPLOY_USER` | Usuário do passo 1 |
| `DEPLOY_SSH_KEY` | Chave privada copiada no passo 1 |
| `DEPLOY_KNOWN_HOSTS` | Linhas copiadas no passo 2 |
| `DEPLOY_PATH` | *(opcional)* Pasta do projeto no servidor. Padrão: `casa-vo-sebastiana` (dentro da home) |
| `DEPLOY_PORT` | *(opcional)* Porta do SSH. Padrão: `22` |

## 4. Testar

No repositório: **Actions → Deploy → Run workflow**. Em alguns minutos o job deve terminar
verde com a mensagem `Deploy concluído` no final do log.

## O que o deploy faz

`scripts/deploy.sh`, dentro da pasta do projeto no servidor:

1. baixa o `main` mais recente (só avança; se houver mudança local, para com erro);
2. reconstrói as imagens;
3. aplica as migrations do banco;
4. sobe a nova versão e espera o app responder no healthcheck;
5. apaga imagens antigas.

Se algum passo falhar, o script para ali e o site continua na versão anterior — o GitHub
mostra o job em vermelho. O mesmo script pode ser rodado à mão: `./scripts/deploy.sh`.
