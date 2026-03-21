// Queries de disponibilidade — calcula slots disponíveis para uma data

import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/server'
import { diaDaSemana } from '@/lib/utils/date'
import type { SlotDisponivel, GradeHorario, DataBloqueada, Agendamento } from '@/types/database'

const FUSO_BR = 'America/Sao_Paulo'

interface ResultadoDisponibilidade {
  slots: SlotDisponivel[]
  erro?: string
}

export async function getSlotsDisponiveis(data: string): Promise<ResultadoDisponibilidade> {
  const supabase = createAdminClient()
  const diaSemana = diaDaSemana(data)

  // 1. Buscar grade de horários do dia da semana
  const { data: grade, error: erroGrade } = await supabase
    .from('grade_horarios')
    .select('*')
    .eq('dia_semana', diaSemana)
    .eq('ativo', true)
    .order('hora_inicio')

  if (erroGrade) return { slots: [], erro: erroGrade.message }
  if (!grade?.length) return { slots: [] }

  // 2. Verificar se o dia inteiro está bloqueado
  const { data: bloqueios } = await supabase
    .from('datas_bloqueadas')
    .select('*')
    .eq('data_bloqueada', data)

  const diaBloqueado = bloqueios?.some((b: DataBloqueada) => b.hora_inicio === null)
  if (diaBloqueado) return { slots: [] }

  const horariosBloqueados = new Set(
    bloqueios
      ?.filter((b: DataBloqueada) => b.hora_inicio !== null)
      .map((b: DataBloqueada) => b.hora_inicio)
  )

  // 3. Buscar agendamentos já ocupados para esta data
  const { data: agendados } = await supabase
    .from('agendamentos')
    .select('hora_inicio')
    .eq('data_agendada', data)
    .in('status', ['pendente', 'confirmado'])

  const horariosOcupados = new Set(
    agendados?.map((a: Pick<Agendamento, 'hora_inicio'>) => a.hora_inicio)
  )

  // 4. Filtrar slots disponíveis
  const slotsDisponiveis: SlotDisponivel[] = (grade as GradeHorario[])
    .filter(
      (slot) =>
        !horariosBloqueados.has(slot.hora_inicio) &&
        !horariosOcupados.has(slot.hora_inicio)
    )
    .map((slot) => ({
      hora_inicio: slot.hora_inicio.slice(0, 5), // BUG-08: normaliza HH:MM:SS → HH:MM
      hora_fim: slot.hora_fim.slice(0, 5),
    }))

  return { slots: slotsDisponiveis }
}

// Retorna as datas com bloqueio de dia inteiro (hora_inicio IS NULL)
// Usado pelo calendário para desabilitar visualmente as datas bloqueadas
export async function getDatasBlockeadas(): Promise<string[]> {
  const supabase = createAdminClient()
  const hoje = formatInTimeZone(new Date(), FUSO_BR, 'yyyy-MM-dd') // BUG-B: usa fuso BR, não UTC

  const { data, error } = await supabase
    .from('datas_bloqueadas')
    .select('data_bloqueada')
    .is('hora_inicio', null)
    .gte('data_bloqueada', hoje)

  if (error) console.error('getDatasBlockeadas:', error)

  return (data ?? []).map((b) => b.data_bloqueada as string)
}

// Retorna os dias da semana com pelo menos 1 slot ativo na grade
// Usado pelo calendário para mostrar apenas dias configurados (BUG-03)
export async function getDiasAtivos(): Promise<number[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('grade_horarios')
    .select('dia_semana')
    .eq('ativo', true)

  const dias = (data ?? []).map((g) => (g as Pick<GradeHorario, 'dia_semana'>).dia_semana)
  return [...new Set(dias)]
}

// Retorna quais datas têm pelo menos 1 slot disponível — O(3 queries) (US-11 / BUG-04)
export async function getDatasComSlotsDisponiveis(datas: string[]): Promise<string[]> {
  if (!datas.length) return []
  const supabase = createAdminClient()

  // 1. Todos os slots ativos por dia da semana
  const { data: gradeData } = await supabase
    .from('grade_horarios')
    .select('dia_semana, hora_inicio')
    .eq('ativo', true)

  const slotsPorDia = new Map<number, Set<string>>()
  for (const g of (gradeData ?? []) as Pick<GradeHorario, 'dia_semana' | 'hora_inicio'>[]) {
    if (!slotsPorDia.has(g.dia_semana)) slotsPorDia.set(g.dia_semana, new Set())
    slotsPorDia.get(g.dia_semana)!.add(g.hora_inicio)
  }

  // 2. Bloqueios (totais e parciais) no período
  const { data: bloqueiosData } = await supabase
    .from('datas_bloqueadas')
    .select('data_bloqueada, hora_inicio')
    .in('data_bloqueada', datas)

  const bloqueiosPorData = new Map<string, Set<string | null>>()
  for (const b of (bloqueiosData ?? []) as Pick<DataBloqueada, 'data_bloqueada' | 'hora_inicio'>[]) {
    if (!bloqueiosPorData.has(b.data_bloqueada)) bloqueiosPorData.set(b.data_bloqueada, new Set())
    bloqueiosPorData.get(b.data_bloqueada)!.add(b.hora_inicio)
  }

  // 3. Agendamentos ocupados no período
  const { data: agendadosData } = await supabase
    .from('agendamentos')
    .select('data_agendada, hora_inicio')
    .in('data_agendada', datas)
    .in('status', ['pendente', 'confirmado'])

  const ocupadosPorData = new Map<string, Set<string>>()
  for (const a of (agendadosData ?? []) as Pick<Agendamento, 'data_agendada' | 'hora_inicio'>[]) {
    if (!ocupadosPorData.has(a.data_agendada)) ocupadosPorData.set(a.data_agendada, new Set())
    ocupadosPorData.get(a.data_agendada)!.add(a.hora_inicio)
  }

  // 4. Calcular datas com pelo menos 1 slot disponível
  const datasComSlots: string[] = []
  for (const data of datas) {
    const diaSemana = diaDaSemana(data)
    const slotsGrade = slotsPorDia.get(diaSemana)
    if (!slotsGrade?.size) continue

    const bloqueios = bloqueiosPorData.get(data)
    if (bloqueios?.has(null)) continue // dia inteiro bloqueado

    let disponiveis = 0
    for (const slot of slotsGrade) {
      if (bloqueios?.has(slot)) continue
      if (ocupadosPorData.get(data)?.has(slot)) continue
      disponiveis++
    }
    if (disponiveis > 0) datasComSlots.push(data)
  }

  return datasComSlots
}

// Verifica se um slot específico está disponível — 1 query (RES-01)
// Usado pelo passo 3 (UX) em vez de getSlotsDisponiveis completo
export async function verificarSlotEspecifico(
  data: string,
  horaInicio: string,
  horaFim: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { count } = await supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('data_agendada', data)
    .eq('hora_inicio', horaInicio)
    .eq('hora_fim', horaFim)
    .in('status', ['pendente', 'confirmado'])

  return count === 0
}

// Retorna datas que têm pelo menos 1 slot disponível em um mês — O(3 queries) (US-11)
export async function getDatasDisponiveis(ano: number, mes: number): Promise<string[]> {
  const primeiroDia = new Date(ano, mes - 1, 1)
  const ultimoDia = new Date(ano, mes, 0)
  const hojeStr = formatInTimeZone(new Date(), FUSO_BR, 'yyyy-MM-dd') // BUG-C: usa fuso BR, não UTC

  const datas: string[] = []
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const dataStr = d.toISOString().split('T')[0]
    if (dataStr >= hojeStr) datas.push(dataStr)
  }

  return getDatasComSlotsDisponiveis(datas)
}
