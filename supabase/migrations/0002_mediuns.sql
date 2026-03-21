-- ============================================================
-- Migration 0002: Cadastro de Médiuns
-- ============================================================

-- Tabela de médiuns da casa
CREATE TABLE mediuns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  especialidade TEXT,
  telefone      TEXT,
  token_acesso  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Associar agendamento a um médium (opcional)
ALTER TABLE agendamentos
  ADD COLUMN medium_id UUID REFERENCES mediuns(id) ON DELETE SET NULL;

-- RLS: authenticated (admin) tem acesso total
ALTER TABLE mediuns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_mediuns"
  ON mediuns FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índices
CREATE INDEX idx_mediuns_token ON mediuns(token_acesso);
CREATE INDEX idx_agendamentos_medium ON agendamentos(medium_id);
