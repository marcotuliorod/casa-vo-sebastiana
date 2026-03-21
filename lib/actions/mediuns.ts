'use server'

// Server Actions para a área pública dos médiuns (acesso via token)

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'

// Médium assume um agendamento disponível
export async function assumirAgendamento(
  agendamentoId: string,
  mediumToken: string
): Promise<{ erro?: string }> {
  const supabase = createAdminClient()

  // Valida o token e obtém o médium
  const { data: medium, error: errMedium } = await supabase
    .from('mediuns')
    .select('id')
    .eq('token_acesso', mediumToken)
    .eq('ativo', true)
    .single()

  if (errMedium || !medium) {
    return { erro: 'Token inválido.' }
  }

  // Verifica se o agendamento ainda está disponível (sem médium)
  const { data: ag, error: errAg } = await supabase
    .from('agendamentos')
    .select('id, medium_id')
    .eq('id', agendamentoId)
    .single()

  if (errAg || !ag) {
    return { erro: 'Agendamento não encontrado.' }
  }

  if (ag.medium_id) {
    return { erro: 'Este agendamento já foi assumido por outro médium.' }
  }

  // Atribui o médium
  const { error } = await supabase
    .from('agendamentos')
    .update({ medium_id: medium.id })
    .eq('id', agendamentoId)

  if (error) return { erro: error.message }

  revalidatePath(`/mediuns/${mediumToken}`)
  return {}
}

// Médium libera um agendamento (devolve ao pool)
export async function liberarAgendamento(
  agendamentoId: string,
  mediumToken: string
): Promise<{ erro?: string }> {
  const supabase = createAdminClient()

  // Valida o token
  const { data: medium, error: errMedium } = await supabase
    .from('mediuns')
    .select('id')
    .eq('token_acesso', mediumToken)
    .eq('ativo', true)
    .single()

  if (errMedium || !medium) {
    return { erro: 'Token inválido.' }
  }

  // Garante que o agendamento pertence a este médium
  const { error } = await supabase
    .from('agendamentos')
    .update({ medium_id: null })
    .eq('id', agendamentoId)
    .eq('medium_id', medium.id)

  if (error) return { erro: error.message }

  revalidatePath(`/mediuns/${mediumToken}`)
  return {}
}
