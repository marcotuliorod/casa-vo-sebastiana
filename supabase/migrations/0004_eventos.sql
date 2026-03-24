-- ============================================================
-- Migration 0004: Atendimento por Evento
-- ============================================================

-- Enum de recorrência
CREATE TYPE recorrencia_tipo AS ENUM (
  'nenhuma',
  'semanal',
  'quinzenal',
  'mensal'
);

-- ─── Tabela: eventos ──────────────────────────────────────────

CREATE TABLE eventos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo               TEXT NOT NULL,
  descricao            TEXT,
  data_inicio          DATE NOT NULL,           -- primeira ocorrência (ou data única)
  hora_inicio          TIME NOT NULL,
  hora_fim             TIME NOT NULL,
  capacidade           INT NOT NULL DEFAULT 10 CHECK (capacidade > 0),
  recorrencia          recorrencia_tipo NOT NULL DEFAULT 'nenhuma',
  data_fim_recorrencia DATE,                    -- NULL = sem fim (cap em app code)
  lembrete_horas       INT NOT NULL DEFAULT 24 CHECK (lembrete_horas > 0),
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT eventos_hora_valida CHECK (hora_fim > hora_inicio),
  CONSTRAINT eventos_recorrencia_valida CHECK (
    data_fim_recorrencia IS NULL OR data_fim_recorrencia >= data_inicio
  )
);

CREATE INDEX idx_eventos_ativo_data ON eventos (ativo, data_inicio);

-- Reutiliza a função set_atualizado_em() criada em 0001_initial.sql
CREATE TRIGGER eventos_atualizado_em
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ─── Adicionar evento_id em agendamentos ──────────────────────

ALTER TABLE agendamentos
  ADD COLUMN evento_id UUID REFERENCES eventos(id) ON DELETE RESTRICT;

-- Índice para contagem de inscritos por evento + data
CREATE INDEX idx_agendamentos_evento
  ON agendamentos (evento_id, data_agendada)
  WHERE evento_id IS NOT NULL;

-- ─── Ajustar constraint GIST ──────────────────────────────────
-- A constraint atual bloqueia sobreposição para TODOS os agendamentos.
-- Para eventos, múltiplos clientes podem ter o mesmo horário (capacidade > 1).
-- A constraint deve se aplicar apenas a agendamentos por horário (evento_id IS NULL).

ALTER TABLE agendamentos
  DROP CONSTRAINT agendamentos_sem_sobreposicao;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_sem_sobreposicao
    EXCLUDE USING GIST (
      data_agendada WITH =,
      TSRANGE(
        (data_agendada + hora_inicio)::TIMESTAMP,
        (data_agendada + hora_fim)::TIMESTAMP
      ) WITH &&
    ) WHERE (status IN ('pendente', 'confirmado') AND evento_id IS NULL);

-- ─── RLS ──────────────────────────────────────────────────────

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

-- Público pode ler eventos ativos (para o fluxo de inscrição)
CREATE POLICY "publico_ler_eventos"
  ON eventos FOR SELECT
  USING (ativo = TRUE);

-- Admin (authenticated) tem acesso total
CREATE POLICY "admin_all_eventos"
  ON eventos FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);
