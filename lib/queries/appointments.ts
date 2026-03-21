// Queries de agendamentos para o painel admin e área pública

import { createAdminClient } from '@/lib/supabase/server'
import type { AgendamentoComCliente, AppointmentStatus } from '@/types/database'

// Buscar agendamento pelo token público (sem login)
export async function getAgendamentoPorToken(token: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      clientes (*)
    `)
    .eq('token_publico', token)
    .single()

  if (error) return null
  return data as AgendamentoComCliente
}

// Listar agendamentos para o painel admin com filtros opcionais
export async function listarAgendamentos(filtros?: {
  data?: string
  status?: AppointmentStatus
  busca?: string
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('agendamentos')
    .select(`
      *,
      clientes (*)
    `)
    .order('data_agendada', { ascending: true })
    .order('hora_inicio', { ascending: true })

  if (filtros?.data) {
    query = query.eq('data_agendada', filtros.data)
  }

  if (filtros?.status) {
    query = query.eq('status', filtros.status)
  }

  const { data, error } = await query

  if (error) return []

  let resultados = data as AgendamentoComCliente[]

  // Filtro de busca por nome ou telefone do cliente
  if (filtros?.busca) {
    const termo = filtros.busca.toLowerCase()
    resultados = resultados.filter(
      (a) =>
        a.clientes.nome.toLowerCase().includes(termo) ||
        a.clientes.telefone.includes(termo)
    )
  }

  return resultados
}

// Estatísticas para o dashboard
export async function getEstatisticas() {
  const supabase = createAdminClient()
  const hoje = new Date().toISOString().split('T')[0]

  const [hoje_count, semana_count, mes_count, total_clientes] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('data_agendada', hoje)
      .not('status', 'eq', 'cancelado'),

    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .gte('data_agendada', hoje)
      .lte('data_agendada', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .not('status', 'eq', 'cancelado'),

    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .gte('criado_em', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .not('status', 'eq', 'cancelado'),

    supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true }),
  ])

  return {
    hoje: hoje_count.count ?? 0,
    semana: semana_count.count ?? 0,
    mes: mes_count.count ?? 0,
    totalClientes: total_clientes.count ?? 0,
  }
}

// Histórico de agendamentos do consulente (por telefone normalizado)
export async function getHistoricoCliente(telefone: string) {
  const supabase = createAdminClient()

  // 1. Buscar cliente pelo telefone
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefone', telefone)
    .single()

  if (!cliente) return []

  // 2. Buscar agendamentos do cliente
  const { data, error } = await supabase
    .from('agendamentos')
    .select('*, clientes(*)')
    .eq('cliente_id', cliente.id)
    .order('data_agendada', { ascending: false })

  if (error) return []
  return data as AgendamentoComCliente[]
}

// Agendamentos para o cron de lembretes
export async function getAgendamentosParaLembrete(data: string) {
  const supabase = createAdminClient()

  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      clientes (*)
    `)
    .eq('data_agendada', data)
    .eq('status', 'confirmado')
    .eq('lembrete_enviado', false)

  if (error) return []
  return agendamentos as AgendamentoComCliente[]
}
