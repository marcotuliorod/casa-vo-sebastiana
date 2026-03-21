// Queries de médiuns

import { createAdminClient } from '@/lib/supabase/server'
import type { Medium, AgendamentoComCliente } from '@/types/database'

// Listar todos os médiuns (admin)
export async function listarMediuns(): Promise<Medium[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('mediuns')
    .select('*')
    .order('nome')

  return (data ?? []) as Medium[]
}

// Buscar médium pelo token de acesso (página pública)
export async function getMediumPorToken(token: string): Promise<Medium | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('mediuns')
    .select('*')
    .eq('token_acesso', token)
    .eq('ativo', true)
    .single()

  if (error) return null
  return data as Medium
}

// Agendamentos já atribuídos ao médium (a partir de hoje)
export async function getAgendamentosDoMedium(
  mediumId: string
): Promise<AgendamentoComCliente[]> {
  const supabase = createAdminClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('agendamentos')
    .select('*, clientes(*)')
    .eq('medium_id', mediumId)
    .gte('data_agendada', hoje)
    .in('status', ['pendente', 'confirmado'])
    .order('data_agendada')
    .order('hora_inicio')

  return (data ?? []) as AgendamentoComCliente[]
}

// Agendamentos sem médium atribuído — disponíveis para assumir
export async function getAgendamentosDisponiveisMedium(): Promise<AgendamentoComCliente[]> {
  const supabase = createAdminClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('agendamentos')
    .select('*, clientes(*)')
    .is('medium_id', null)
    .gte('data_agendada', hoje)
    .in('status', ['pendente', 'confirmado'])
    .order('data_agendada')
    .order('hora_inicio')

  return (data ?? []) as AgendamentoComCliente[]
}
