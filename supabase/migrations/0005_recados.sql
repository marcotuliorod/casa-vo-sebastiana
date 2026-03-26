-- Mural de recados para médiuns
CREATE TABLE recados (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT        NOT NULL,
  conteudo      TEXT        NOT NULL,
  prioridade    TEXT        NOT NULL DEFAULT 'normal'
                            CHECK (prioridade IN ('normal', 'importante', 'urgente')),
  fixado        BOOLEAN     NOT NULL DEFAULT false,
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recados_ativo ON recados (fixado DESC, criado_em DESC)
  WHERE ativo = true;

ALTER TABLE recados ENABLE ROW LEVEL SECURITY;

-- Admin escreve via service_role (createAdminClient)
CREATE POLICY "service_role_full" ON recados
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Área do médium lê via anon (acesso por token, sem autenticação Supabase)
CREATE POLICY "anon_read_active" ON recados
  FOR SELECT TO anon USING (ativo = true);
