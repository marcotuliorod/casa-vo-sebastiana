// Schema Drizzle — espelha supabase/migrations/0001..0005 (ver plano de migração)
//
// O que NÃO está aqui, por não ser expressável no DSL do Drizzle, e vive em
// drizzle/<gerado>_extra.sql (extensions, a constraint EXCLUDE USING GIST de
// agendamentos e os triggers de atualizado_em):
//   - CREATE EXTENSION pgcrypto / btree_gist
//   - agendamentos_sem_sobreposicao (EXCLUDE USING GIST ... WHERE ...)
//   - set_atualizado_em() + triggers BEFORE UPDATE
//
// RLS não foi recriada — autorização é só na camada de aplicação (ver Contexto do plano).

import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  time,
  smallint,
  integer,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from 'drizzle-orm/pg-core'

// ─── Enums ───────────────────────────────────────────────────

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pendente',
  'confirmado',
  'cancelado',
  'realizado',
  'nao_compareceu',
])

export const whatsappEventoEnum = pgEnum('whatsapp_evento', [
  'confirmacao_agendamento',
  'lembrete_24h',
  'cancelamento',
])

export const whatsappStatusEnum = pgEnum('whatsapp_status', [
  'na_fila',
  'enviado',
  'entregue',
  'falhou',
])

export const recorrenciaTipoEnum = pgEnum('recorrencia_tipo', [
  'nenhuma',
  'semanal',
  'quinzenal',
  'mensal',
])

// ─── clientes ────────────────────────────────────────────────

export const clientes = pgTable('clientes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nome: text('nome').notNull(),
  telefone: text('telefone').notNull().unique('clientes_telefone_unique'),
  email: text('email'),
  notas: text('notas'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
})

// ─── grade_horarios ──────────────────────────────────────────

export const gradeHorarios = pgTable(
  'grade_horarios',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    diaSemana: smallint('dia_semana').notNull(),
    horaInicio: time('hora_inicio').notNull(),
    horaFim: time('hora_fim').notNull(),
    ativo: boolean('ativo').notNull().default(true),
  },
  (t) => [
    uniqueIndex('grade_horarios_unique').on(t.diaSemana, t.horaInicio),
    check('grade_horarios_dia_semana_check', sql`${t.diaSemana} BETWEEN 0 AND 6`),
  ]
)

// ─── datas_bloqueadas ────────────────────────────────────────

export const datasBloqueadas = pgTable(
  'datas_bloqueadas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    dataBloqueada: date('data_bloqueada').notNull(),
    horaInicio: time('hora_inicio'),
    horaFim: time('hora_fim'),
    motivo: text('motivo'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('datas_bloqueadas_unique').on(t.dataBloqueada, t.horaInicio)]
)

// ─── mediuns ─────────────────────────────────────────────────

export const mediuns = pgTable('mediuns', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  nome: text('nome').notNull(),
  especialidade: text('especialidade'),
  telefone: text('telefone'),
  tokenAcesso: text('token_acesso')
    .notNull()
    .unique('mediuns_token_acesso_unique')
    .default(sql`encode(gen_random_bytes(24), 'hex')`),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})

// ─── eventos ─────────────────────────────────────────────────

export const eventos = pgTable(
  'eventos',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    dataInicio: date('data_inicio').notNull(),
    horaInicio: time('hora_inicio').notNull(),
    horaFim: time('hora_fim').notNull(),
    capacidade: integer('capacidade').notNull().default(10),
    recorrencia: recorrenciaTipoEnum('recorrencia').notNull().default('nenhuma'),
    dataFimRecorrencia: date('data_fim_recorrencia'),
    lembreteHoras: integer('lembrete_horas').notNull().default(24),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_eventos_ativo_data').on(t.ativo, t.dataInicio),
    check('eventos_capacidade_check', sql`${t.capacidade} > 0`),
    check('eventos_lembrete_horas_check', sql`${t.lembreteHoras} > 0`),
    check('eventos_hora_valida', sql`${t.horaFim} > ${t.horaInicio}`),
    check(
      'eventos_recorrencia_valida',
      sql`${t.dataFimRecorrencia} IS NULL OR ${t.dataFimRecorrencia} >= ${t.dataInicio}`
    ),
  ]
)

// ─── agendamentos ────────────────────────────────────────────
// A constraint EXCLUDE USING GIST (agendamentos_sem_sobreposicao) não é
// expressável aqui — está em drizzle/<gerado>_extra.sql.

export const agendamentos = pgTable(
  'agendamentos',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    dataAgendada: date('data_agendada').notNull(),
    horaInicio: time('hora_inicio').notNull(),
    horaFim: time('hora_fim').notNull(),
    status: appointmentStatusEnum('status').notNull().default('pendente'),
    notas: text('notas'),
    motivoCancelamento: text('motivo_cancelamento'),
    mediumId: uuid('medium_id').references(() => mediuns.id, { onDelete: 'set null' }),
    eventoId: uuid('evento_id').references(() => eventos.id, { onDelete: 'restrict' }),
    tokenPublico: text('token_publico')
      .notNull()
      .unique('agendamentos_token_publico_unique')
      .default(sql`encode(gen_random_bytes(24), 'hex')`),
    lembreteEnviado: boolean('lembrete_enviado').notNull().default(false),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('agendamentos_data_idx').on(t.dataAgendada),
    index('agendamentos_status_idx').on(t.status),
    index('agendamentos_token_idx').on(t.tokenPublico),
    index('idx_agendamentos_medium').on(t.mediumId),
    index('idx_agendamentos_evento').on(t.eventoId, t.dataAgendada).where(sql`${t.eventoId} IS NOT NULL`),
    index('agendamentos_lembrete_idx')
      .on(t.dataAgendada, t.lembreteEnviado)
      .where(sql`${t.status} = 'confirmado' AND ${t.lembreteEnviado} = FALSE`),
  ]
)

// ─── logs_whatsapp ───────────────────────────────────────────

export const logsWhatsapp = pgTable(
  'logs_whatsapp',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agendamentoId: uuid('agendamento_id')
      .notNull()
      .references(() => agendamentos.id, { onDelete: 'cascade' }),
    evento: whatsappEventoEnum('evento').notNull(),
    provedor: text('provedor').notNull(),
    paraTelefone: text('para_telefone').notNull(),
    mensagem: text('mensagem').notNull(),
    idMensagemProvedor: text('id_mensagem_provedor'),
    status: whatsappStatusEnum('status').notNull().default('na_fila'),
    mensagemErro: text('mensagem_erro'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('logs_whatsapp_agendamento_idx').on(t.agendamentoId)]
)

// ─── whatsapp_queue ──────────────────────────────────────────

export const whatsappQueue = pgTable(
  'whatsapp_queue',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agendamentoId: uuid('agendamento_id').references(() => agendamentos.id, { onDelete: 'set null' }),
    telefone: text('telefone').notNull(),
    mensagem: text('mensagem').notNull(),
    tipo: text('tipo').notNull(),
    tentativas: integer('tentativas').notNull().default(0),
    maxTentativas: integer('max_tentativas').notNull().default(3),
    status: text('status').notNull().default('pendente'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    proximoRetry: timestamp('proximo_retry', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('whatsapp_queue_pendentes').on(t.status, t.proximoRetry).where(sql`${t.status} = 'pendente'`),
    check('whatsapp_queue_tipo_check', sql`${t.tipo} IN ('confirmacao', 'lembrete_24h', 'cancelamento', 'admin')`),
    check('whatsapp_queue_status_check', sql`${t.status} IN ('pendente', 'enviado', 'falhou')`),
  ]
)

// ─── recados ─────────────────────────────────────────────────

export const recados = pgTable(
  'recados',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    titulo: text('titulo').notNull(),
    conteudo: text('conteudo').notNull(),
    prioridade: text('prioridade').notNull().default('normal'),
    fixado: boolean('fixado').notNull().default(false),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_recados_ativo').on(t.fixado.desc(), t.criadoEm.desc()).where(sql`${t.ativo} = true`),
    check('recados_prioridade_check', sql`${t.prioridade} IN ('normal', 'importante', 'urgente')`),
  ]
)

// ─── Auth.js (schema padrão do @auth/drizzle-adapter) ────────
// Sessão é JWT (ver Contexto do plano) — accounts/sessions ficam sem uso em
// runtime (sem OAuth, sem DB sessions), mas são mantidas para seguir o
// contrato padrão do adapter em vez de um subconjunto customizado.

export const authUsers = pgTable('auth_users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique('auth_users_email_unique'),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
})

// Nomes de propriedade JS em snake_case aqui (refresh_token, access_token, ...)
// são exigidos pelo shape estrutural DefaultPostgresAccountsTable do
// @auth/drizzle-adapter — ver node_modules/@auth/drizzle-adapter/lib/pg.d.ts.
export const authAccounts = pgTable(
  'auth_accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
)

export const authSessions = pgTable('auth_sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const authVerificationTokens = pgTable(
  'auth_verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
)
