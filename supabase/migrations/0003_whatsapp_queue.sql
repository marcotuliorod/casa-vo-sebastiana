-- Migration 0003: Fila de retry para mensagens WhatsApp com falha
-- US-16: Retry automático para WhatsApp com falha

CREATE TABLE whatsapp_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id  UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
  telefone        TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('confirmacao', 'lembrete_24h', 'cancelamento', 'admin')),
  tentativas      INT NOT NULL DEFAULT 0,
  max_tentativas  INT NOT NULL DEFAULT 3,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'falhou')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  proximo_retry   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para o cron buscar itens pendentes eficientemente
CREATE INDEX whatsapp_queue_pendentes ON whatsapp_queue (status, proximo_retry)
  WHERE status = 'pendente';

-- RLS: somente service_role acessa (admin queries bypass RLS)
ALTER TABLE whatsapp_queue ENABLE ROW LEVEL SECURITY;
