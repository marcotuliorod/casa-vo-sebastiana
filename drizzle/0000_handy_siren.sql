-- Extensões exigidas pelo schema: uuid/token gen (pgcrypto) e a constraint
-- EXCLUDE USING GIST de agendamentos (btree_gist). Precisam existir antes das
-- tabelas, já que várias colunas usam gen_random_uuid()/gen_random_bytes() como default.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('pendente', 'confirmado', 'cancelado', 'realizado', 'nao_compareceu');--> statement-breakpoint
CREATE TYPE "public"."recorrencia_tipo" AS ENUM('nenhuma', 'semanal', 'quinzenal', 'mensal');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_evento" AS ENUM('confirmacao_agendamento', 'lembrete_24h', 'cancelamento');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_status" AS ENUM('na_fila', 'enviado', 'entregue', 'falhou');--> statement-breakpoint
CREATE TABLE "agendamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"data_agendada" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL,
	"status" "appointment_status" DEFAULT 'pendente' NOT NULL,
	"notas" text,
	"motivo_cancelamento" text,
	"medium_id" uuid,
	"evento_id" uuid,
	"token_publico" text DEFAULT encode(gen_random_bytes(24), 'hex') NOT NULL,
	"lembrete_enviado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agendamentos_token_publico_unique" UNIQUE("token_publico")
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text,
	"notas" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_telefone_unique" UNIQUE("telefone")
);
--> statement-breakpoint
CREATE TABLE "datas_bloqueadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_bloqueada" date NOT NULL,
	"hora_inicio" time,
	"hora_fim" time,
	"motivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"data_inicio" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL,
	"capacidade" integer DEFAULT 10 NOT NULL,
	"recorrencia" "recorrencia_tipo" DEFAULT 'nenhuma' NOT NULL,
	"data_fim_recorrencia" date,
	"lembrete_horas" integer DEFAULT 24 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_capacidade_check" CHECK ("eventos"."capacidade" > 0),
	CONSTRAINT "eventos_lembrete_horas_check" CHECK ("eventos"."lembrete_horas" > 0),
	CONSTRAINT "eventos_hora_valida" CHECK ("eventos"."hora_fim" > "eventos"."hora_inicio"),
	CONSTRAINT "eventos_recorrencia_valida" CHECK ("eventos"."data_fim_recorrencia" IS NULL OR "eventos"."data_fim_recorrencia" >= "eventos"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "grade_horarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dia_semana" smallint NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "grade_horarios_dia_semana_check" CHECK ("grade_horarios"."dia_semana" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE TABLE "logs_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agendamento_id" uuid NOT NULL,
	"evento" "whatsapp_evento" NOT NULL,
	"provedor" text NOT NULL,
	"para_telefone" text NOT NULL,
	"mensagem" text NOT NULL,
	"id_mensagem_provedor" text,
	"status" "whatsapp_status" DEFAULT 'na_fila' NOT NULL,
	"mensagem_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mediuns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"especialidade" text,
	"telefone" text,
	"token_acesso" text DEFAULT encode(gen_random_bytes(24), 'hex') NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mediuns_token_acesso_unique" UNIQUE("token_acesso")
);
--> statement-breakpoint
CREATE TABLE "recados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"conteudo" text NOT NULL,
	"prioridade" text DEFAULT 'normal' NOT NULL,
	"fixado" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recados_prioridade_check" CHECK ("recados"."prioridade" IN ('normal', 'importante', 'urgente'))
);
--> statement-breakpoint
CREATE TABLE "whatsapp_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agendamento_id" uuid,
	"telefone" text NOT NULL,
	"mensagem" text NOT NULL,
	"tipo" text NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"max_tentativas" integer DEFAULT 3 NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"proximo_retry" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_queue_tipo_check" CHECK ("whatsapp_queue"."tipo" IN ('confirmacao', 'lembrete_24h', 'cancelamento', 'admin')),
	CONSTRAINT "whatsapp_queue_status_check" CHECK ("whatsapp_queue"."status" IN ('pendente', 'enviado', 'falhou'))
);
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_medium_id_mediuns_id_fk" FOREIGN KEY ("medium_id") REFERENCES "public"."mediuns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs_whatsapp" ADD CONSTRAINT "logs_whatsapp_agendamento_id_agendamentos_id_fk" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_agendamento_id_agendamentos_id_fk" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agendamentos_data_idx" ON "agendamentos" USING btree ("data_agendada");--> statement-breakpoint
CREATE INDEX "agendamentos_status_idx" ON "agendamentos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agendamentos_token_idx" ON "agendamentos" USING btree ("token_publico");--> statement-breakpoint
CREATE INDEX "idx_agendamentos_medium" ON "agendamentos" USING btree ("medium_id");--> statement-breakpoint
CREATE INDEX "idx_agendamentos_evento" ON "agendamentos" USING btree ("evento_id","data_agendada") WHERE "agendamentos"."evento_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "agendamentos_lembrete_idx" ON "agendamentos" USING btree ("data_agendada","lembrete_enviado") WHERE "agendamentos"."status" = 'confirmado' AND "agendamentos"."lembrete_enviado" = FALSE;--> statement-breakpoint
CREATE UNIQUE INDEX "datas_bloqueadas_unique" ON "datas_bloqueadas" USING btree ("data_bloqueada","hora_inicio");--> statement-breakpoint
CREATE INDEX "idx_eventos_ativo_data" ON "eventos" USING btree ("ativo","data_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_horarios_unique" ON "grade_horarios" USING btree ("dia_semana","hora_inicio");--> statement-breakpoint
CREATE INDEX "logs_whatsapp_agendamento_idx" ON "logs_whatsapp" USING btree ("agendamento_id");--> statement-breakpoint
CREATE INDEX "idx_recados_ativo" ON "recados" USING btree ("fixado" DESC NULLS LAST,"criado_em" DESC NULLS LAST) WHERE "recados"."ativo" = true;--> statement-breakpoint
CREATE INDEX "whatsapp_queue_pendentes" ON "whatsapp_queue" USING btree ("status","proximo_retry") WHERE "whatsapp_queue"."status" = 'pendente';
--> statement-breakpoint
-- Evita double-booking: não pode haver dois agendamentos pendente/confirmado
-- no mesmo horário, exceto para agendamentos de evento (capacidade > 1).
-- Não expressável no DSL do Drizzle — ver supabase/migrations/0001_initial.sql e 0004_eventos.sql.
ALTER TABLE "agendamentos"
  ADD CONSTRAINT "agendamentos_sem_sobreposicao"
  EXCLUDE USING GIST (
    "data_agendada" WITH =,
    TSRANGE(
      ("data_agendada" + "hora_inicio")::TIMESTAMP,
      ("data_agendada" + "hora_fim")::TIMESTAMP
    ) WITH &&
  ) WHERE ("status" IN ('pendente', 'confirmado') AND "evento_id" IS NULL);--> statement-breakpoint

-- Trigger genérico de atualizado_em — ver supabase/migrations/0001_initial.sql
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER clientes_atualizado_em
  BEFORE UPDATE ON "clientes"
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();--> statement-breakpoint

CREATE TRIGGER agendamentos_atualizado_em
  BEFORE UPDATE ON "agendamentos"
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();--> statement-breakpoint

CREATE TRIGGER logs_whatsapp_atualizado_em
  BEFORE UPDATE ON "logs_whatsapp"
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();--> statement-breakpoint

CREATE TRIGGER eventos_atualizado_em
  BEFORE UPDATE ON "eventos"
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
