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

// Mapa de id → nome para múltiplos médiuns (batch, para histórico do consulente)
export async function getMediunsNomesMap(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const supabase = createAdminClient()
  const { data } = await supabase.from('mediuns').select('id, nome').in('id', ids)
  const map: Record<string, string> = {}
  for (const m of data ?? []) map[(m as { id: string; nome: string }).id] = (m as { id: string; nome: string }).nome
  return map
}

// Buscar nome de um médium pelo id — para exibição na confirmação pública (US-10)
export async function getMediumNome(id: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('mediuns')
    .select('nome')
    .eq('id', id)
    .single()

  return (data as { nome: string } | null)?.nome ?? null
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
