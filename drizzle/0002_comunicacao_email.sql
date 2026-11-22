CREATE TYPE "public"."email_evento" AS ENUM('confirmacao_agendamento', 'lembrete_24h', 'cancelamento');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('enviado', 'falhou');--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agendamento_id" uuid,
	"destinatarios" text NOT NULL,
	"assunto" text NOT NULL,
	"texto" text NOT NULL,
	"html" text NOT NULL,
	"tipo" text NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"max_tentativas" integer DEFAULT 3 NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"proximo_retry" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_queue_tipo_check" CHECK ("email_queue"."tipo" IN ('confirmacao', 'lembrete_24h', 'cancelamento', 'admin', 'medium')),
	CONSTRAINT "email_queue_status_check" CHECK ("email_queue"."status" IN ('pendente', 'enviado', 'falhou'))
);
--> statement-breakpoint
CREATE TABLE "logs_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agendamento_id" uuid NOT NULL,
	"evento" "email_evento" NOT NULL,
	"para_email" text NOT NULL,
	"assunto" text NOT NULL,
	"id_mensagem_provedor" text,
	"status" "email_status" NOT NULL,
	"mensagem_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mediuns" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_agendamento_id_agendamentos_id_fk" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs_email" ADD CONSTRAINT "logs_email_agendamento_id_agendamentos_id_fk" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_queue_pendentes" ON "email_queue" USING btree ("status","proximo_retry") WHERE "email_queue"."status" = 'pendente';--> statement-breakpoint
CREATE INDEX "logs_email_agendamento_idx" ON "logs_email" USING btree ("agendamento_id");