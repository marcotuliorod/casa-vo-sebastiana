-- ============================================================
-- Casa de Vó Sebastiana — Schema Inicial
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ─── Enums ───────────────────────────────────────────────────

CREATE TYPE appointment_status AS ENUM (
  'pendente',
  'confirmado',
  'cancelado',
  'realizado',
  'nao_compareceu'
);

CREATE TYPE whatsapp_evento AS ENUM (
  'confirmacao_agendamento',
  'lembrete_24h',
  'cancelamento'
);

CREATE TYPE whatsapp_status AS ENUM (
  'na_fila',
  'enviado',
  'entregue',
  'falhou'
);

-- ─── Tabela: clientes ─────────────────────────────────────────

CREATE TABLE clientes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  telefone    TEXT NOT NULL,  -- E.164: +5511999999999
  email       TEXT,
  notas       TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT clientes_telefone_unique UNIQUE (telefone)
);

-- ─── Tabela: grade_horarios ───────────────────────────────────
-- Template semanal: define quais horários estão abertos por dia da semana

CREATE TABLE grade_horarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
  hora_inicio     TIME NOT NULL,   -- ex: 09:00
  hora_fim        TIME NOT NULL,   -- ex: 09:30
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT grade_horarios_unique UNIQUE (dia_semana, hora_inicio)
);

-- ─── Tabela: datas_bloqueadas ─────────────────────────────────
-- Override: dia inteiro ou horário específico bloqueado

CREATE TABLE datas_bloqueadas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_bloqueada  DATE NOT NULL,
  hora_inicio     TIME,      -- NULL = dia inteiro bloqueado
  hora_fim        TIME,
  motivo          TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT datas_bloqueadas_unique UNIQUE (data_bloqueada, hora_inicio)
);

-- ─── Tabela: agendamentos ─────────────────────────────────────

CREATE TABLE agendamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  data_agendada   DATE NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fim        TIME NOT NULL,
  status          appointment_status NOT NULL DEFAULT 'pendente',
  notas           TEXT,
  motivo_cancelamento TEXT,
  -- Token público para links de auto-serviço (sem login)
  token_publico   TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  lembrete_enviado BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Evitar double-booking: não pode ter dois agendamentos pendente/confirmado no mesmo horário
  CONSTRAINT agendamentos_sem_sobreposicao
    EXCLUDE USING GIST (
      data_agendada WITH =,
      TSRANGE(
        (data_agendada + hora_inicio)::TIMESTAMP,
        (data_agendada + hora_fim)::TIMESTAMP
      ) WITH &&
    ) WHERE (status IN ('pendente', 'confirmado'))
);

CREATE INDEX agendamentos_data_idx ON agendamentos (data_agendada);
CREATE INDEX agendamentos_status_idx ON agendamentos (status);
CREATE INDEX agendamentos_token_idx ON agendamentos (token_publico);
CREATE INDEX agendamentos_lembrete_idx
  ON agendamentos (data_agendada, lembrete_enviado)
  WHERE status = 'confirmado' AND lembrete_enviado = FALSE;

-- ─── Tabela: logs_whatsapp ────────────────────────────────────

CREATE TABLE logs_whatsapp (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id    UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  evento            whatsapp_evento NOT NULL,
  provedor          TEXT NOT NULL,           -- 'twilio' | 'zapi'
  para_telefone     TEXT NOT NULL,
  mensagem          TEXT NOT NULL,
  id_mensagem_provedor TEXT,                 -- SID do Twilio ou zaapId do Z-API
  status            whatsapp_status NOT NULL DEFAULT 'na_fila',
  mensagem_erro     TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX logs_whatsapp_agendamento_idx ON logs_whatsapp (agendamento_id);

-- ─── Trigger: atualizado_em automático ───────────────────────

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clientes_atualizado_em
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER agendamentos_atualizado_em
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER logs_whatsapp_atualizado_em
  BEFORE UPDATE ON logs_whatsapp
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ─── Row Level Security ───────────────────────────────────────

ALTER TABLE clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_horarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE datas_bloqueadas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_whatsapp       ENABLE ROW LEVEL SECURITY;

-- Público: leitura da grade (para calcular disponibilidade no front)
CREATE POLICY "publico_ler_grade"
  ON grade_horarios FOR SELECT USING (TRUE);

CREATE POLICY "publico_ler_bloqueados"
  ON datas_bloqueadas FOR SELECT USING (TRUE);

-- Admin (usuários autenticados): acesso total
CREATE POLICY "admin_total_clientes"
  ON clientes FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_total_agendamentos"
  ON agendamentos FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_total_grade"
  ON grade_horarios FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_total_bloqueados"
  ON datas_bloqueadas FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_total_logs"
  ON logs_whatsapp FOR ALL USING (auth.role() = 'authenticated');

-- Nota: Server Actions usam service_role key (bypass RLS) para operações públicas
-- como criar agendamento sem login.
