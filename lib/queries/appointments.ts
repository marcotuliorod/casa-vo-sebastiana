// Queries de agendamentos para o painel admin e área pública

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/server'
import type { AgendamentoComCliente, AppointmentStatus } from '@/types/database'

const TZ = 'America/Sao_Paulo'

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
  periodo?: 'hoje' | '7dias' | 'semana' | 'mes'
  status?: AppointmentStatus
  busca?: string
  medium_id?: string
  tipo?: 'evento' | 'horario'
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

  if (filtros?.periodo) {
    const agora = new Date()
    const hoje = formatInTimeZone(agora, TZ, 'yyyy-MM-dd')
    switch (filtros.periodo) {
      case 'hoje':
        query = query.eq('data_agendada', hoje)
        break
      case '7dias': {
        const daqui7 = formatInTimeZone(new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd')
        query = query.gte('data_agendada', hoje).lte('data_agendada', daqui7)
        break
      }
      case 'semana': {
        const dia = agora.getDay()
        const offsetSeg = dia === 0 ? -6 : 1 - dia
        const segunda = new Date(agora)
        segunda.setDate(agora.getDate() + offsetSeg)
        const domingo = new Date(segunda)
        domingo.setDate(segunda.getDate() + 6)
        query = query
          .gte('data_agendada', formatInTimeZone(segunda, TZ, 'yyyy-MM-dd'))
          .lte('data_agendada', formatInTimeZone(domingo, TZ, 'yyyy-MM-dd'))
        break
      }
      case 'mes': {
        const mesInicio = formatInTimeZone(agora, TZ, 'yyyy-MM') + '-01'
        const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)
        const mesFim = formatInTimeZone(new Date(proximoMes.getTime() - 1), TZ, 'yyyy-MM-dd')
        query = query.gte('data_agendada', mesInicio).lte('data_agendada', mesFim)
        break
      }
    }
  }

  if (filtros?.status) {
    query = query.eq('status', filtros.status)
  }

  if (filtros?.busca) {
    const buscaSegura = filtros.busca
      .slice(0, 50)
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
    query = query.or(
      `nome.ilike.%${buscaSegura}%,telefone.ilike.%${buscaSegura}%`,
      { foreignTable: 'clientes' }
    )
  }

  if (filtros?.medium_id) {
    query = query.eq('medium_id', filtros.medium_id)
  }

  if (filtros?.tipo === 'evento') {
    query = query.not('evento_id', 'is', null)
  } else if (filtros?.tipo === 'horario') {
    query = query.is('evento_id', null)
  }

  const { data, error } = await query

  if (error) return []

  return data as AgendamentoComCliente[]
}

// Estatísticas para o dashboard
export async function getEstatisticas() {
  const supabase = createAdminClient()
  const agora = new Date()
  const hoje = formatInTimeZone(agora, TZ, 'yyyy-MM-dd')
  const daqui7 = formatInTimeZone(new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd')

  const [hoje_count, semana_count, mes_count, total_clientes, pendentes_count] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('data_agendada', hoje)
      .not('status', 'eq', 'cancelado'),

    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .gte('data_agendada', hoje)
      .lte('data_agendada', daqui7)
      .not('status', 'eq', 'cancelado'),

    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .gte('criado_em', fromZonedTime(
        `${formatInTimeZone(agora, TZ, 'yyyy-MM')}-01T00:00:00`,
        TZ
      ).toISOString())
      .not('status', 'eq', 'cancelado'),

    supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true }),

    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente'),
  ])

  return {
    hoje: hoje_count.count ?? 0,
    semana: semana_count.count ?? 0,
    mes: mes_count.count ?? 0,
    totalClientes: total_clientes.count ?? 0,
    pendentes: pendentes_count.count ?? 0,
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
