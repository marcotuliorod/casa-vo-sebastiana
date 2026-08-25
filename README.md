# 🕯️ Casa de Vó Sebastiana — Sistema de Agendamento

Sistema web completo de agendamento espiritual para o terreiro **Casa de Vó Sebastiana** (umbanda). Inclui fluxo público de agendamento em 3 passos, painel administrativo protegido e notificações automáticas via WhatsApp.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14.2.5 (App Router) + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui (Radix UI) |
| Banco de dados | Postgres 17 self-hosted (Docker) + Drizzle ORM |
| Autenticação | Auth.js (NextAuth v5) — Magic Link via Resend |
| WhatsApp | Z-API (padrão) ou Twilio (Strategy Pattern) |
| Deploy | Docker Compose self-hosted (app + Postgres + Caddy + cron + backup) |
| Datas | date-fns + date-fns-tz (America/Sao_Paulo) |
| Calendário | react-day-picker |
| Ícones | Lucide React |

> Projeto migrado do Supabase (banco gerenciado + Auth) para esta stack self-hosted, partindo de uma base nova (sem importação de dados). A fonte de verdade do schema é `lib/db/schema.ts` + `drizzle/`.

---

## Funcionalidades

### Área Pública
- **Fluxo de agendamento em 3 passos** (mobile-first):
  1. Escolher data — calendário interativo (Ter–Sáb, até 60 dias)
  2. Escolher horário — grid de slots de 30 min disponíveis
  3. Preencher dados — nome, telefone (WhatsApp), e-mail, observações
- **Página do agendamento** acessível por link público via token (sem login)
- **Auto-cancelamento** via link público

### Painel Admin (protegido por login)
- Dashboard com estatísticas (hoje, semana, mês, total de consulentes)
- Lista de agendamentos com filtros (data, status, busca por nome/telefone)
- Gerenciamento de disponibilidade:
  - Ativar/desativar slots da grade semanal
  - Bloquear datas ou horários específicos
- Lista de consulentes (clientes)

### Automação WhatsApp
- **Confirmação** — enviada ao criar um agendamento
- **Lembrete 24h** — cron diário às 09:00 BRT (container `cron` do Compose)
- **Cancelamento** — enviado ao cancelar

---

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Conta no [Resend](https://resend.com) (gratuita) — envio do magic link de login
- Conta no [Z-API](https://z-api.io) ou [Twilio](https://twilio.com) para WhatsApp

---

## Configuração Local

### 1. Instalar dependências

```bash
cd casa-vo-sebastiana
npm install
```

### 2. Variáveis de ambiente

Copie o arquivo de exemplo e preencha os valores:

```bash
cp .env.example .env
```

Os campos mais importantes (ver `.env.example` para a lista completa e comentada):

```bash
# ─── Postgres / Docker Compose ──────────────────────────────────
POSTGRES_USER=app
POSTGRES_PASSWORD=              # escolha uma senha
POSTGRES_DB=casa_vo_sebastiana
# IMPORTANTE: a senha aqui precisa ser IDÊNTICA a POSTGRES_PASSWORD acima —
# env_file não faz substituição de variável, as duas não se sincronizam sozinhas.
DATABASE_URL=postgres://app:MESMA_SENHA_ACIMA@postgres:5432/casa_vo_sebastiana

# ─── Autenticação (Auth.js) ─────────────────────────────────────
AUTH_SECRET=                    # gere com: npx auth secret
AUTH_URL=http://localhost:3000  # URL pública do site
RESEND_API_KEY=re_...
AUTH_EMAIL_FROM=Casa de Vó Sebastiana <login@seudominio.com.br>

# ─── WhatsApp ───────────────────────────────────────────────────
WHATSAPP_PROVIDER=zapi          # 'zapi' ou 'twilio'
ZAPI_INSTANCE_ID=
ZAPI_INSTANCE_TOKEN=
ZAPI_CLIENT_TOKEN=

# ─── Cron / Admin ───────────────────────────────────────────────
CRON_SECRET=                    # gere com: openssl rand -hex 32
ADMIN_EMAILS=                   # emails autorizados a acessar /admin, separados por vírgula
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Banco de dados

**Opção A — Docker Compose (recomendado, sobe tudo junto):**

```bash
docker compose up -d --build
docker compose exec app npx drizzle-kit migrate
```

**Opção B — Postgres local avulso, para rodar `npm run dev` fora do Docker:**

```bash
docker run -d --name pg-dev -e POSTGRES_USER=app -e POSTGRES_PASSWORD=SUA_SENHA \
  -e POSTGRES_DB=casa_vo_sebastiana -p 5432:5432 postgres:17-alpine

DATABASE_URL=postgres://app:SUA_SENHA@localhost:5432/casa_vo_sebastiana npm run db:migrate
```

Em ambas as opções, depois de migrar, popule a grade de horários padrão (terça a sábado):

```bash
psql "$DATABASE_URL" -f drizzle/seed.sql
```

### 4. Rodar localmente

Com o Postgres já de pé (Opção B acima):

```bash
npm run dev
```

Acesse: http://localhost:3000

Ou, para rodar tudo via Docker (mais próximo de produção):

```bash
docker compose up -d --build
```

Acesse: https://localhost (certificado local automático do Caddy)

---

## Variáveis de Ambiente — Referência Completa

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Connection string do Postgres usada pela aplicação |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Sim | Credenciais do container Postgres — a senha precisa bater com a de `DATABASE_URL` |
| `AUTH_SECRET` | Sim | Chave de assinatura das sessões JWT do Auth.js |
| `AUTH_URL` | Sim | URL pública do site — evita links quebrados atrás de proxy |
| `RESEND_API_KEY` | Sim | API key do Resend, usada pelo Auth.js para enviar o magic link |
| `AUTH_EMAIL_FROM` | Sim | Remetente do e-mail de login |
| `DOMAIN` | Não | Domínio servido pelo Caddy (TLS automático); `localhost` para testes locais |
| `WHATSAPP_PROVIDER` | Sim | `zapi` ou `twilio` |
| `ZAPI_INSTANCE_ID` / `ZAPI_INSTANCE_TOKEN` / `ZAPI_CLIENT_TOKEN` | Se PROVIDER=zapi | Credenciais Z-API |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` | Se PROVIDER=twilio | Credenciais Twilio |
| `CRON_SECRET` | Sim | Token para autenticar chamadas do cron (mínimo 32 caracteres) |
| `ADMIN_EMAILS` | Não | Lista de e-mails autorizados no `/admin`, separados por vírgula. Vazio = qualquer usuário autenticado |
| `ADMIN_WHATSAPP` | Não | Número que recebe notificações de novos agendamentos/cancelamentos |
| `NEXT_PUBLIC_BASE_URL` | Sim | URL base para links nas mensagens WhatsApp |

---

## Banco de Dados

### Postgres self-hosted

O banco roda em container Docker (`postgres:17-alpine`), na rede interna do Compose — **nunca exposto à internet**. Schema e migrations vivem em `lib/db/schema.ts` (Drizzle) + `drizzle/*.sql` (gerado pelo `drizzle-kit`, com extensões/constraint/triggers complementados manualmente onde o DSL do Drizzle não alcança).

Comandos úteis:
```bash
npm run db:generate   # gera uma nova migration a partir de mudanças em lib/db/schema.ts
npm run db:migrate    # aplica migrations pendentes
npm run db:studio     # abre o Drizzle Studio (explorador de dados no navegador)
```

### Tabelas

#### `clientes`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | Identificador único |
| `nome` | TEXT | Nome completo |
| `telefone` | TEXT UNIQUE | Telefone E.164 (+5511999999999) |
| `email` | TEXT | E-mail (opcional) |
| `notas` | TEXT | Observações internas |
| `criado_em` | TIMESTAMPTZ | Data de criação |
| `atualizado_em` | TIMESTAMPTZ | Atualizado automaticamente por trigger |

#### `grade_horarios`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | |
| `dia_semana` | SMALLINT | 0=Dom … 6=Sáb |
| `hora_inicio` | TIME | Ex: 09:00 |
| `hora_fim` | TIME | Ex: 09:30 |
| `ativo` | BOOLEAN | Se o slot está habilitado |

#### `datas_bloqueadas`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | |
| `data_bloqueada` | DATE | Data do bloqueio |
| `hora_inicio` | TIME (nullable) | NULL = dia inteiro bloqueado |
| `hora_fim` | TIME (nullable) | |
| `motivo` | TEXT | Motivo opcional |

#### `agendamentos`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | |
| `cliente_id` | UUID FK | Referência a `clientes` |
| `data_agendada` | DATE | Data da consulta |
| `hora_inicio` | TIME | Horário de início |
| `hora_fim` | TIME | Horário de fim |
| `status` | ENUM | `pendente`, `confirmado`, `cancelado`, `realizado`, `nao_compareceu` |
| `notas` | TEXT | Observações do cliente |
| `motivo_cancelamento` | TEXT | Preenchido ao cancelar |
| `token_publico` | TEXT UNIQUE | Token hex-48 para links públicos sem login |
| `lembrete_enviado` | BOOLEAN | Controle de idempotência do cron |
| `criado_em` | TIMESTAMPTZ | |
| `atualizado_em` | TIMESTAMPTZ | Auto-atualizado por trigger |

> **Constraint anti-double-booking:** exclusion constraint GIST impede agendamentos sobrepostos com status `pendente` ou `confirmado` (exceto agendamentos de evento, que têm capacidade > 1). Erro Postgres `23P01` é capturado (via `lib/db/errors.ts`) e exibe mensagem amigável ao usuário.

#### `logs_whatsapp`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | |
| `agendamento_id` | UUID FK | |
| `evento` | ENUM | `confirmacao_agendamento`, `lembrete_24h`, `cancelamento` |
| `provedor` | TEXT | `zapi` ou `twilio` |
| `para_telefone` | TEXT | Destinatário |
| `mensagem` | TEXT | Conteúdo enviado |
| `id_mensagem_provedor` | TEXT | SID Twilio ou zaapId Z-API |
| `status` | ENUM | `na_fila`, `enviado`, `entregue`, `falhou` |
| `mensagem_erro` | TEXT | Detalhes em caso de falha |

### Autorização — camada de aplicação, não RLS

Diferente do Supabase, este Postgres não usa Row Level Security. Toda autorização é feita na camada de aplicação:
- `middleware.ts` protege `/admin/*` (sessão Auth.js válida + `ADMIN_EMAILS`).
- Cada Server Action de mutação em `lib/actions/*` chama `verificarAdmin()` (`lib/auth/admin.ts`) antes de tocar o banco.
- Rotas públicas (agendamento, cancelamento, mural do médium via token) não exigem sessão — a validação é o token em si (`token_publico`/`token_acesso`), não uma policy de banco.

---

## Arquitetura

### Mapa de Rotas

| Rota | Tipo | Descrição |
|------|------|-----------|
| `/` | Server Component | Redireciona para `/agendar` |
| `/agendar` | Server Component | Passo 1 — calendário (`dynamic = 'force-dynamic'`: disponibilidade muda a cada agendamento) |
| `/agendar/[data]` | Server Component | Passo 2 — slots disponíveis |
| `/agendar/confirmar` | Server Component | Passo 3 — formulário |
| `/agendar/eventos` | Server Component | Lista de eventos com inscrição aberta (`force-dynamic`) |
| `/agendar/eventos/[id]` | Server Component | Inscrição em um evento |
| `/agendamento/[token]` | Server Component | Detalhe público (sem login) |
| `/agendamento/[token]/cancelar` | Client Component | Confirmação de cancelamento |
| `/historico` | Server Component | Busca de histórico do consulente por telefone |
| `/mediuns/[token]` | Server Component | Área do médium (assumir/liberar agendamentos, mural de recados) |
| `/auth/login` | Client Component | Login admin (magic link via Auth.js) |
| `/api/auth/[...nextauth]` | API Route | Rotas nativas do Auth.js (signin, callback, session, csrf…) |
| `/admin` | Server Component | Dashboard (protegido) |
| `/admin/agendamentos` | Server Component | Lista com filtros |
| `/admin/disponibilidade` | Server Component | Grade e bloqueios |
| `/admin/consulentes` | Server Component | Lista de clientes |
| `/admin/mediuns` | Server Component | Cadastro de médiuns |
| `/admin/eventos` | Server Component | Cadastro/edição de eventos recorrentes |
| `/admin/recados` | Server Component | Mural de recados para médiuns |
| `/api/cron/lembretes` | API Route | Disparado pelo container `cron`: lembretes (horário + evento) e retry da fila de WhatsApp |
| `/api/webhooks/twilio` | API Route | Webhook de status Twilio (assinatura HMAC validada) |
| `/api/webhooks/zapi` | API Route | Webhook de status Z-API (client-token validado) |

### Estrutura de Arquivos

```
casa-vo-sebastiana/
├── app/
│   ├── layout.tsx                    # Root layout (metadata PT-BR)
│   ├── page.tsx                      # Redirect → /agendar
│   ├── globals.css                   # Tailwind + variáveis CSS
│   ├── agendar/
│   │   ├── layout.tsx                # Header + footer do fluxo
│   │   ├── page.tsx                  # Passo 1: calendário
│   │   ├── CalendarioAgendamento.tsx # Client: react-day-picker
│   │   ├── [data]/page.tsx           # Passo 2: grid de horários
│   │   ├── confirmar/page.tsx        # Passo 3: BookingForm
│   │   └── eventos/                  # Lista + inscrição em eventos recorrentes
│   ├── agendamento/[token]/
│   │   ├── page.tsx                  # Detalhe público
│   │   └── cancelar/page.tsx         # Cancelar agendamento
│   ├── historico/                    # Busca de histórico do consulente por telefone
│   ├── mediuns/[token]/              # Área do médium: assumir/liberar + mural de recados
│   ├── auth/
│   │   └── login/page.tsx            # Magic link (Auth.js)
│   ├── admin/
│   │   ├── layout.tsx                # Sidebar autenticada — gate de sessão + ADMIN_EMAILS
│   │   ├── AdminNav.tsx              # Client: navegação lateral
│   │   ├── page.tsx                  # Dashboard stats + calendário mensal
│   │   ├── agendamentos/page.tsx     # Lista + filtros
│   │   ├── disponibilidade/page.tsx  # Grade semanal + bloqueios
│   │   ├── consulentes/page.tsx      # Lista de clientes
│   │   ├── mediuns/page.tsx          # Cadastro de médiuns
│   │   ├── eventos/page.tsx          # Cadastro/edição de eventos
│   │   └── recados/page.tsx          # Mural de recados
│   └── api/
│       ├── auth/[...nextauth]/route.ts # Rotas nativas do Auth.js
│       ├── cron/lembretes/route.ts   # Lembretes + retry da fila (disparado pelo container cron)
│       └── webhooks/twilio/route.ts, webhooks/zapi/route.ts
│
├── components/
│   ├── booking/
│   │   ├── BookingForm.tsx           # Formulário passo 3 (useFormState)
│   │   ├── ProgressSteps.tsx         # Indicador de progresso 1/2/3
│   │   └── TimeSlotGrid.tsx          # Grid de horários clicáveis
│   ├── admin/
│   │   ├── AppointmentTable.tsx      # Tabela de agendamentos
│   │   ├── StatCard.tsx              # Card de estatística
│   │   └── StatusBadge.tsx           # Badge colorido por status
│   ├── shared/
│   │   └── Logo.tsx                  # Identidade visual
│   └── ui/                           # shadcn/ui: badge, button, card, input…
│
├── lib/
│   ├── db/
│   │   ├── index.ts                  # Instância singleton do Drizzle
│   │   ├── schema.ts                 # Schema completo (tabelas + enums + relations)
│   │   ├── mappers.ts                # Linhas do Drizzle → tipos de app (types/database.ts)
│   │   └── errors.ts                 # mensagemErro()/codigoPg() — erros do driver postgres
│   ├── auth/
│   │   ├── config.edge.ts            # Config Auth.js edge-safe (usada por middleware.ts)
│   │   ├── config.ts                 # Config completa (adapter + provider Resend)
│   │   ├── emails.ts                 # emailAutorizado() — lógica pura da allowlist ADMIN_EMAILS
│   │   └── admin.ts                  # getAdminUser()/verificarAdmin() — usados por layout e actions
│   ├── whatsapp/
│   │   ├── types.ts                  # Interface ProvedorWhatsApp
│   │   ├── factory.ts                # getProvedorWhatsApp() factory
│   │   ├── templates.ts              # mensagens de confirmação/lembrete/cancelamento/eventos
│   │   └── providers/
│   │       ├── zapi.ts               # ZApiProvider (REST)
│   │       └── twilio.ts             # TwilioProvider (HTTP Basic)
│   ├── actions/
│   │   ├── booking.ts                # criarAgendamento + inscreverEmEvento + cancelarAgendamento
│   │   ├── admin.ts                  # CRUD de agendamentos/grade/médiuns/eventos/clientes
│   │   ├── mediuns.ts                # assumirAgendamento + liberarAgendamento (via token)
│   │   └── recados.ts                # CRUD do mural de recados
│   ├── queries/
│   │   ├── availability.ts           # getSlotsDisponiveis + getDatasDisponiveis
│   │   ├── appointments.ts           # listarAgendamentos + getEstatisticas + …
│   │   ├── calendario.ts             # Contagens por dia para o calendário do dashboard
│   │   ├── eventos.ts                # Ocorrências e contagem de inscritos por evento
│   │   ├── mediuns.ts                # Listagem de médiuns
│   │   └── recados.ts                # Listagem de recados ativos
│   └── utils/
│       ├── date.ts                   # Helpers date-fns-tz (America/Sao_Paulo)
│       ├── phone.ts                  # normalizarTelefone + validarTelefone
│       ├── recorrencia.ts            # Cálculo de ocorrências de eventos recorrentes
│       └── cn.ts                     # clsx + tailwind-merge
│
├── types/
│   └── database.ts                   # Tipos TypeScript das tabelas
│
├── drizzle/
│   ├── 0000_*.sql                    # Migration gerada + extensions/constraint/triggers manuais
│   ├── seed.sql                      # Grade padrão Ter–Sáb
│   └── meta/                         # Journal do drizzle-kit
│
├── docker/
│   ├── postgres/init.sql             # Extensions criadas no primeiro boot do container
│   ├── caddy/Caddyfile               # Reverse proxy + TLS automático
│   ├── cron/                         # Container que dispara /api/cron/lembretes
│   └── backup/backup.sh              # pg_dump diário com retenção
│
├── __tests__/                         # Vitest: actions, queries, utils, templates, componentes
│   └── db/                            # Testes de integração contra Postgres real (precisam de DATABASE_URL)
├── load-tests/                       # k6: smoke, load e stress test
├── .github/workflows/ci.yml          # Type-check + lint + test (com Postgres real) em cada push/PR
├── middleware.ts                     # Protege /admin/* → sessão Auth.js válida + ADMIN_EMAILS
├── Dockerfile                        # Build standalone do Next.js
├── docker-compose.yml                # app + postgres + proxy + cron + backup
├── drizzle.config.ts                 # Config do drizzle-kit
├── next.config.mjs                   # output: standalone, headers de segurança, Server Actions
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── components.json                   # shadcn/ui config
└── .env.example                      # Template de variáveis
```

---

## WhatsApp — Strategy Pattern

O sistema usa o padrão Strategy para suportar múltiplos provedores sem alterar o código de negócio.

### Interface (`lib/whatsapp/types.ts`)

```typescript
interface ProvedorWhatsApp {
  enviarMensagem(msg: { para: string; corpo: string }): Promise<ResultadoEnvio>
}
```

### Factory (`lib/whatsapp/factory.ts`)

```typescript
// Lê WHATSAPP_PROVIDER do .env e retorna a instância correta
const provedor = getProvedorWhatsApp() // ZApiProvider | TwilioProvider
```

### Trocar de provedor

Basta alterar uma linha no `.env`:
```bash
WHATSAPP_PROVIDER=twilio   # ou zapi
```

### Z-API (`lib/whatsapp/providers/zapi.ts`)
- Endpoint: `POST https://api.z-api.io/instances/{id}/token/{token}/send-text`
- Header: `Client-Token: {ZAPI_CLIENT_TOKEN}`
- Telefone: sem `+` (ex: `5511999999999`)

### Twilio (`lib/whatsapp/providers/twilio.ts`)
- Endpoint: `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`
- Auth: HTTP Basic (`SID:AuthToken`)
- From/To: `whatsapp:+número`

---

## Autenticação Admin

1. Acesse `/auth/login`
2. Digite o e-mail do administrador
3. Receba o magic link por e-mail via Resend (válido por 24h)
4. Clique no link → redireciona para `/admin`

`middleware.ts` protege todas as rotas `/admin/*`: exige sessão Auth.js válida (JWT) **e**, se
`ADMIN_EMAILS` estiver configurado, que o e-mail do usuário esteja na lista — quem não estiver é
redirecionado para `/auth/login`, mesmo com uma sessão válida. `app/admin/layout.tsx` repete a
mesma checagem (via `lib/auth/admin.ts`) como defesa em profundidade. As Server Actions de mutação
(`lib/actions/admin.ts`, `lib/actions/recados.ts`) usam o mesmo helper.

A config do Auth.js é dividida em duas partes por causa do Edge Runtime: `lib/auth/config.edge.ts`
(sem adapter, usada por `middleware.ts`) e `lib/auth/config.ts` (completa, com o adapter Drizzle e o
provider Resend — usada em Server Actions, Server Components e na rota de API).

> **Adicionar um admin:** basta incluir o e-mail em `ADMIN_EMAILS` (variável de ambiente) e a
> pessoa fazer login normalmente pelo `/auth/login` — o registro do usuário é criado
> automaticamente no primeiro login (não existe um passo de "convidar usuário" separado).

---

## Cron Job — Lembretes 24h

**Schedule:** `0 12 * * *` (12:00 UTC = 09:00 BRT), disparado pelo container `cron` do Docker Compose (ver `docker/cron/`).

**Endpoint:** `GET /api/cron/lembretes`

**Autenticação:**
```bash
Authorization: Bearer {CRON_SECRET}
```

**Lógica:**
1. Busca agendamentos com `status = 'confirmado'`, `data_agendada = amanhã`, `lembrete_enviado = false`
2. Para cada agendamento: envia mensagem WhatsApp via provedor configurado
3. Registra resultado em `logs_whatsapp`
4. Marca `lembrete_enviado = true` (idempotente — não envia duplicatas)
5. Retorna `{ processados, falhas }`

**Testar manualmente:**
```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  http://localhost:3000/api/cron/lembretes
```

---

## Deploy self-hosted (Docker Compose)

### 1. Provisionar o host

Qualquer servidor com Docker e Docker Compose (VPS, servidor próprio etc.). Aponte o domínio desejado para o IP do servidor.

### 2. Configurar `.env`

Copie `.env.example` para `.env` no servidor e preencha os valores de produção — em especial `DOMAIN` (domínio real, não `localhost`), `AUTH_URL` (`https://` + o mesmo domínio) e senhas fortes.

### 3. Subir a stack

```bash
git clone <repo> && cd casa-vo-sebastiana
cp .env.example .env   # editar com os valores reais
docker compose up -d --build
docker compose exec app npx drizzle-kit migrate
```

O Caddy (serviço `proxy`) obtém certificado TLS automaticamente via Let's Encrypt para o `DOMAIN` configurado — só a porta 80/443 do proxy fica exposta; Postgres nunca é acessível de fora.

### 4. Deploy de atualizações

```bash
git pull && docker compose up -d --build
```

Migrations pendentes precisam ser aplicadas manualmente após o deploy: `docker compose exec app npx drizzle-kit migrate`.

### 5. Backups

O container `backup` roda `pg_dump` diário com retenção de 14 dias, salvo no volume `backup_data`. Teste o restore periodicamente:
```bash
docker compose exec -T postgres pg_restore -U app -d casa_vo_sebastiana --clean < seu_backup.dump
```

---

## Scripts Disponíveis

```bash
npm run dev          # Servidor local com hot-reload (http://localhost:3000)
npm run build        # Build de produção
npm run start        # Servidor de produção local
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run test         # Vitest (testes de integração precisam de DATABASE_URL)
npm run db:generate  # Gera uma migration a partir de lib/db/schema.ts
npm run db:migrate   # Aplica migrations pendentes
npm run db:studio    # Drizzle Studio — explorador de dados no navegador
```

---

## Operações Comuns

### Adicionar novo admin
Adicione o e-mail em `ADMIN_EMAILS` e peça para a pessoa fazer login em `/auth/login` — o registro é criado no primeiro login via magic link.

### Testar o cron localmente
```bash
curl -H "Authorization: Bearer $(grep CRON_SECRET .env | cut -d= -f2)" \
  http://localhost:3000/api/cron/lembretes
```

### Verificar logs de WhatsApp
```bash
npm run db:studio   # abre o Drizzle Studio, navegue até logs_whatsapp
# ou:
docker compose exec postgres psql -U app -d casa_vo_sebastiana -c "SELECT * FROM logs_whatsapp ORDER BY criado_em DESC LIMIT 20;"
```

### Bloquear um dia no painel
Acesse `/admin/disponibilidade` → seção "Bloquear Data" → selecione a data → salvar

---

## Decisões Técnicas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Config file | `next.config.mjs` | Next.js 14.2.5 não suporta `.ts` para config |
| Forms | `useFormState` + `useFormStatus` | React 18 (Next.js 14); `useActionState` é React 19+ |
| Anti-double-booking | Exclusion constraint GIST | Garantia a nível de banco, não só na aplicação |
| Token público | `encode(gen_random_bytes(24), 'hex')` | 48 chars hex = 192 bits de entropia, não adivinhável |
| Telefone | E.164 normalizado | Compatível com ambos provedores WhatsApp |
| Timezone | `America/Sao_Paulo` via date-fns-tz | Evita bugs de horário de verão e UTC offset |
| `useFormStatus` | Extraído em componente filho | Deve ser chamado dentro do form, não no componente que contém `<form>` |
| RLS não recriada no Postgres novo | Autorização só na camada de aplicação | Todo acesso a dados já passava por um client privilegiado (equivalente ao `service_role`); RLS nunca foi o mecanismo real de enforcement — ver seção "Autorização" acima |
| Config do Auth.js dividida (edge/full) | `config.edge.ts` sem adapter + `config.ts` completa | O adapter Drizzle carrega o driver `postgres` (Node/TCP), incompatível com o Edge Runtime onde `middleware.ts` roda — mesmo com sessão JWT, só o *import* do adapter já quebraria o middleware |
| Erros do driver Postgres | `.cause.code`, não `.code` | drizzle-orm envolve o erro original num `DrizzleQueryError` — `lib/db/errors.ts` centraliza a extração |
| Postgres sem porta exposta | Só a rede interna do Compose | App e banco no mesmo Compose — nenhuma porta do Postgres é publicada, reduzindo a superfície de ataque |
