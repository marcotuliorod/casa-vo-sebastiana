ALTER TYPE "public"."email_evento" ADD VALUE 'confirmacao_casa';--> statement-breakpoint
ALTER TYPE "public"."email_evento" ADD VALUE 'alteracao';--> statement-breakpoint
ALTER TABLE "email_queue" DROP CONSTRAINT "email_queue_tipo_check";--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_tipo_check" CHECK ("email_queue"."tipo" IN ('confirmacao', 'lembrete_24h', 'cancelamento', 'admin', 'medium', 'confirmacao_casa', 'alteracao'));