'use server'

// Server Actions para a área pública dos médiuns (acesso via token)

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, mediuns } from '@/lib/db/schema'
import { mensagemErro } from '@/lib/db/errors'

// Médium assume um agendamento disponível
export async function assumirAgendamento(
  agendamentoId: string,
  mediumToken: string
): Promise<{ erro?: string }> {
  // Valida o token e obtém o médium
  const [medium] = await db
    .select({ id: mediuns.id })
    .from(mediuns)
    .where(and(eq(mediuns.tokenAcesso, mediumToken), eq(mediuns.ativo, true)))
    .limit(1)

  if (!medium) {
    return { erro: 'Token inválido.' }
  }

  // Verifica se o agendamento ainda está disponível (sem médium)
  const [ag] = await db
    .select({ id: agendamentos.id, mediumId: agendamentos.mediumId })
    .from(agendamentos)
    .where(eq(agendamentos.id, agendamentoId))
    .limit(1)

  if (!ag) {
    return { erro: 'Agendamento não encontrado.' }
  }

  if (ag.mediumId) {
    return { erro: 'Este agendamento já foi assumido por outro médium.' }
  }

  // Atribui o médium
  try {
    await db.update(agendamentos).set({ mediumId: medium.id }).where(eq(agendamentos.id, agendamentoId))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath(`/mediuns/${mediumToken}`)
  revalidatePath('/admin/agendamentos') // GAP-05: sincroniza admin quando médium assume
  revalidatePath('/admin')
  return {}
}

// Médium libera um agendamento (devolve ao pool)
export async function liberarAgendamento(
  agendamentoId: string,
  mediumToken: string
): Promise<{ erro?: string }> {
  // Valida o token
  const [medium] = await db
    .select({ id: mediuns.id })
    .from(mediuns)
    .where(and(eq(mediuns.tokenAcesso, mediumToken), eq(mediuns.ativo, true)))
    .limit(1)

  if (!medium) {
    return { erro: 'Token inválido.' }
  }

  // Garante que o agendamento pertence a este médium
  try {
    await db
      .update(agendamentos)
      .set({ mediumId: null })
      .where(and(eq(agendamentos.id, agendamentoId), eq(agendamentos.mediumId, medium.id)))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath(`/mediuns/${mediumToken}`)
  revalidatePath('/admin/agendamentos') // GAP-05: sincroniza admin quando médium libera
  revalidatePath('/admin')
  return {}
}
