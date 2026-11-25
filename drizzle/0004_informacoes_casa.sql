CREATE TABLE "configuracoes_casa" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"endereco" text,
	"link_mapa" text,
	"email_contato" text,
	"telefone_contato" text,
	"orientacoes" text,
	"politica_cancelamento" text,
	"responsavel_dados" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "configuracoes_casa_linha_unica" CHECK ("configuracoes_casa"."id" = 1)
);
