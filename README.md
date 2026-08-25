# 🕯️ Casa de Vó Sebastiana — Sistema de Agendamento

Sistema web completo de agendamento espiritual para o terreiro **Casa de Vó Sebastiana** (umbanda). Inclui fluxo público de agendamento em 3 passos, painel administrativo protegido e notificações automáticas via WhatsApp.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14.2.5 (App Router) + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui (Radix UI) |
| Banco de dados | Supabase (PostgreSQL 17) |
| Autenticação | Supabase Auth — Magic Link (email OTP) |
| WhatsApp | Z-API (padrão) ou Twilio (Strategy Pattern) |
| Deploy | Vercel (com cron jobs nativos) |
| Datas | date-fns + date-fns-tz (America/Sao_Paulo) |
| Calendário | react-day-picker |
| Ícones | Lucide React |

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
- **Lembrete 24h** — cron job diário às 09:00 BRT
- **Cancelamento** — enviado ao cancelar

---

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (gratuita)
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
cp .env.example .env.local
```

Edite `.env.local`:

```bash
# ─── Supabase ─────────────────────────────────────────────────
# Encontre em: supabase.com → projeto → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # "anon" key — segura para o cliente
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # "service_role" — NUNCA expor no front

# ─── WhatsApp ─────────────────────────────────────────────────
WHATSAPP_PROVIDER=zapi                        # 'zapi' ou 'twilio'

# Z-API (https://app.z-api.io)
ZAPI_INSTANCE_ID=
ZAPI_INSTANCE_TOKEN=
ZAPI_CLIENT_TOKEN=

# Twilio (alternativo)
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=+14155238886

# ─── Cron ─────────────────────────────────────────────────────
# Gere com: openssl rand -hex 32
CRON_SECRET=

# ─── App ──────────────────────────────────────────────────────
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

> **service_role key:** Acesse o Supabase Dashboard → Settings → API → "service_role" → clique em "Reveal"

### 3. Banco de dados

O banco já está migrado no projeto Supabase `yvrxjpfpmlzsnfszslzd`. Para replicar em outro projeto:

```bash
# Via Supabase CLI
supabase db push

# Ou execute manualmente no SQL Editor do Supabase:
# 1. supabase/migrations/0001_initial.sql  (schema + RLS)
# 2. supabase/seed.sql                     (horários padrão)
```

### 4. Rodar localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## Variáveis de Ambiente — Referência Completa

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave pública anon (exposta no client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave secreta service_role (só server-side) |
| `WHATSAPP_PROVIDER` | Sim | `zapi` ou `twilio` |
| `ZAPI_INSTANCE_ID` | Se PROVIDER=zapi | ID da instância Z-API |
| `ZAPI_INSTANCE_TOKEN` | Se PROVIDER=zapi | Token da instância Z-API |
| `ZAPI_CLIENT_TOKEN` | Se PROVIDER=zapi | Client Token Z-API (header) |
| `TWILIO_ACCOUNT_SID` | Se PROVIDER=twilio | Account SID do Twilio |
| `TWILIO_AUTH_TOKEN` | Se PROVIDER=twilio | Auth Token do Twilio |
| `TWILIO_WHATSAPP_FROM` | Se PROVIDER=twilio | Número WhatsApp Twilio |
| `CRON_SECRET` | Sim | Token para autenticar chamadas do cron |
| `NEXT_PUBLIC_BASE_URL` | Sim | URL base para links nas mensagens WhatsApp |

---

## Banco de Dados

### Projeto Supabase

- **Projeto:** `Casa_de_Vo_Sebastiana`
- **ID:** `yvrxjpfpmlzsnfszslzd`
- **URL:** `https://yvrxjpfpmlzsnfszslzd.supabase.co`
- **Região:** us-west-2
- **PostgreSQL:** 17.6.1

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

> **Constraint anti-double-booking:** exclusion constraint GIST impede agendamentos sobrepostos com status `pendente` ou `confirmado`. Erro Postgres `23P01` é capturado e exibe mensagem amigável ao usuário.

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

### Row Level Security (RLS)

| Tabela | Anon (público) | Authenticated (admin) |
|--------|---------------|----------------------|
| `grade_horarios` | SELECT | ALL |
| `datas_bloqueadas` | SELECT | ALL |
| `eventos` | SELECT (somente `ativo = true`) | ALL |
| `recados` | SELECT (somente `ativo = true`) | — (escrita via `service_role`) |
| `clientes` | — | ALL |
| `agendamentos` | — | ALL |
| `logs_whatsapp` | — | ALL |
| `mediuns` | — | ALL |
| `whatsapp_queue` | — | — (acesso só via `service_role`) |

> Server Actions usam `service_role` (bypass RLS) para operações públicas como criar agendamento sem login.
> A allowlist `ADMIN_EMAILS` é aplicada na camada de aplicação (middleware + Server Actions via
> `lib/auth/admin.ts`), não nas policies acima — qualquer usuário `authenticated` passa nas
> policies de RLS. Não exponha o cliente `anon`+sessão para consultar essas tabelas diretamente
> fora do fluxo já protegido do app.

---

## Arquitetura

### Mapa de Rotas

| Rota | Tipo | Descrição |
|------|------|-----------|
| `/` | Server Component | Redireciona para `/agendar` |
| `/agendar` | Server Component | Passo 1 — calendário |
| `/agendar/[data]` | Server Component | Passo 2 — slots disponíveis |
| `/agendar/confirmar` | Server Component | Passo 3 — formulário |
| `/agendar/eventos` | Server Component | Lista de eventos com inscrição aberta |
| `/agendar/eventos/[id]` | Server Component | Inscrição em um evento |
| `/agendamento/[token]` | Server Component | Detalhe público (sem login) |
| `/agendamento/[token]/cancelar` | Client Component | Confirmação de cancelamento |
| `/historico` | Server Component | Busca de histórico do consulente por telefone |
| `/mediuns/[token]` | Server Component | Área do médium (assumir/liberar agendamentos, mural de recados) |
| `/auth/login` | Client Component | Login admin (magic link) |
| `/auth/callback` | API Route | Callback OAuth Supabase |
| `/admin` | Server Component | Dashboard (protegido) |
| `/admin/agendamentos` | Server Component | Lista com filtros |
| `/admin/disponibilidade` | Server Component | Grade e bloqueios |
| `/admin/consulentes` | Server Component | Lista de clientes |
| `/admin/mediuns` | Server Component | Cadastro de médiuns |
| `/admin/eventos` | Server Component | Cadastro/edição de eventos recorrentes |
| `/admin/recados` | Server Component | Mural de recados para médiuns |
| `/api/cron/lembretes` | API Route | Cron job diário: lembretes (horário + evento) e retry da fila de WhatsApp |
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
│   │   ├── login/page.tsx            # Email OTP
│   │   └── callback/route.ts         # Supabase callback
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
│       ├── cron/lembretes/route.ts   # Cron diário: lembretes + retry da fila
│       ├── webhooks/twilio/route.ts  # Status Twilio (assinatura validada)
│       └── webhooks/zapi/route.ts    # Status Z-API (client-token validado)
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
│   ├── supabase/
│   │   ├── client.ts                 # createClient() — browser (anon key)
│   │   └── server.ts                 # createAdminClient() + createServerSessionClient()
│   ├── auth/
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
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial.sql          # Schema base + RLS (clientes, agendamentos, grade…)
│   │   ├── 0002_mediuns.sql          # Tabela de médiuns + token de acesso
│   │   ├── 0003_whatsapp_queue.sql   # Fila de retry de mensagens com falha
│   │   ├── 0004_eventos.sql          # Atendimento por evento com recorrência
│   │   └── 0005_recados.sql          # Mural de recados
│   └── seed.sql                      # Grade padrão Ter–Sáb
│
├── __tests__/                        # Vitest: actions, queries, utils, templates, componentes
├── load-tests/                       # k6: smoke, load e stress test
├── .github/workflows/ci.yml          # Type-check + lint + test em cada push/PR
├── middleware.ts                     # Protege /admin/* → sessão válida + ADMIN_EMAILS
├── vercel.json                       # Cron: 0 12 * * * (09:00 BRT)
├── next.config.mjs                   # Headers de segurança + Server Actions allowedOrigins
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

Basta alterar uma linha no `.env.local`:
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
3. Receba o magic link por e-mail (válido por 1 hora)
4. Clique no link → redireciona para `/admin`

O middleware (`middleware.ts`) protege todas as rotas `/admin/*`: exige sessão válida (revalidada
via `getUser()`) **e**, se `ADMIN_EMAILS` estiver configurado, que o e-mail do usuário esteja na
lista — quem não estiver é redirecionado para `/auth/login`, mesmo com uma sessão Supabase válida.
`app/admin/layout.tsx` repete a mesma checagem (via `lib/auth/admin.ts`) como defesa em
profundidade. As Server Actions de mutação (`lib/actions/admin.ts`, `lib/actions/recados.ts`)
usam o mesmo helper.

> **Configurar admin:** No Supabase Dashboard → Authentication → Users → "Invite user" com o e-mail do administrador.

---

## Cron Job — Lembretes 24h

**Schedule:** `0 12 * * *` (12:00 UTC = 09:00 BRT)

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

## Deploy na Vercel

### 1. Conectar repositório

```bash
vercel --prod
```

### 2. Configurar variáveis de ambiente

No painel da Vercel → Settings → Environment Variables, adicione todas as variáveis do `.env.example` com os valores de produção.

### 3. Cron job

O `vercel.json` já configura automaticamente o cron ao fazer deploy:

```json
{
  "crons": [{
    "path": "/api/cron/lembretes",
    "schedule": "0 12 * * *"
  }]
}
```

> Cron jobs na Vercel requerem plano Pro ou superior.

### 4. URL de produção

Após o deploy, atualize a variável:
```bash
NEXT_PUBLIC_BASE_URL=https://casavosebastiana.com.br
```

---

## Scripts Disponíveis

```bash
npm run dev        # Servidor local com hot-reload (http://localhost:3000)
npm run build      # Build de produção
npm run start      # Servidor de produção local
npm run lint       # ESLint
```

---

## Operações Comuns

### Adicionar novo admin
No Supabase Dashboard → Authentication → Users → "Invite user"

### Testar o cron localmente
```bash
curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3000/api/cron/lembretes
```

### Verificar logs de WhatsApp
No Supabase Dashboard → Table Editor → `logs_whatsapp`

### Bloquear um dia no painel
Acesse `/admin/disponibilidade` → seção "Bloquear Data" → selecione a data → salvar

---

## Decisões Técnicas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Config file | `next.config.mjs` | Next.js 14.2.5 não suporta `.ts` para config |
| Forms | `useFormState` + `useFormStatus` | React 18 (Next.js 14); `useActionState` é React 19+ |
| RLS bypass | `service_role` nas Server Actions | Agendamentos públicos precisam escrever sem autenticação |
| Anti-double-booking | Exclusion constraint GIST | Garantia a nível de banco, não só na aplicação |
| Token público | `encode(gen_random_bytes(24), 'hex')` | 48 chars hex = 192 bits de entropia, não adivinhável |
| Telefone | E.164 normalizado | Compatível com ambos provedores WhatsApp |
| Timezone | `America/Sao_Paulo` via date-fns-tz | Evita bugs de horário de verão e UTC offset |
| `useFormStatus` | Extraído em componente filho | Deve ser chamado dentro do form, não no componente que contém `<form>` |
