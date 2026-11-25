// Cadastro do consulente a partir do formulário público (agendamento e inscrição em evento)

import { sql } from 'drizzle-orm'
import type { db } from '@/lib/db'
import { clientes } from '@/lib/db/schema'

type ExecutorInsert = Pick<typeof db, 'insert'>

/**
 * Salva o consulente pelo telefone (a chave do cadastro).
 *
 * Se o telefone já existe, o formulário público NÃO troca o e-mail do cadastro:
 * senão, quem soubesse o telefone de outra pessoa poderia apontar o cadastro
 * (e o "Meus agendamentos", que é buscado pelo e-mail) para o próprio e-mail.
 * - o e-mail só é preenchido quando o cadastro antigo não tinha nenhum;
 * - o nome só é atualizado quando o e-mail informado é o mesmo do cadastro.
 * Trocar o e-mail de um consulente é tarefa da Casa, pelo painel.
 */
export function salvarCliente(
  executor: ExecutorInsert,
  dados: { nome: string; telefone: string; email: string }
) {
  return executor
    .insert(clientes)
    .values(dados)
    .onConflictDoUpdate({
      target: clientes.telefone,
      set: {
        nome: sql`CASE WHEN ${clientes.email} IS NULL OR lower(${clientes.email}) = lower(excluded.email) THEN excluded.nome ELSE ${clientes.nome} END`,
        email: sql`COALESCE(${clientes.email}, excluded.email)`,
      },
    })
    .returning()
}
