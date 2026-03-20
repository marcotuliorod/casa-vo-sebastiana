// Queries de disponibilidade — calcula slots disponíveis para uma data

import { createAdminClient } from '@/lib/supabase/server'
import { diaDaSemana } from '@/lib/utils/date'
import type { SlotDisponivel, GradeHorario, DataBloqueada, Agendamento } from '@/types/database'

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
      hora_inicio: slot.hora_inicio,
      hora_fim: slot.hora_fim,
    }))

  return { slots: slotsDisponiveis }
}

// Retorna as datas com bloqueio de dia inteiro (hora_inicio IS NULL)
// Usado pelo calendário para desabilitar visualmente as datas bloqueadas
export async function getDatasBlockeadas(): Promise<string[]> {
  const supabase = createAdminClient()
  const hoje = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('datas_bloqueadas')
    .select('data_bloqueada')
    .is('hora_inicio', null)
    .gte('data_bloqueada', hoje)

  return (data ?? []).map((b) => b.data_bloqueada as string)
}

// Retorna datas que têm pelo menos 1 slot disponível em um mês
export async function getDatasDisponiveis(ano: number, mes: number): Promise<string[]> {
  const supabase = createAdminClient()

  // Buscar grade ativa
  const { data: grade } = await supabase
    .from('grade_horarios')
    .select('dia_semana')
    .eq('ativo', true)

  if (!grade?.length) return []

  const diasComHorario = new Set((grade as GradeHorario[]).map((g) => g.dia_semana))

  // Gerar todas as datas do mês
  const primeiroDia = new Date(ano, mes - 1, 1)
  const ultimoDia = new Date(ano, mes, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const datasDisponiveis: string[] = []

  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    if (d < hoje) continue
    if (!diasComHorario.has(d.getDay())) continue

    const dataStr = d.toISOString().split('T')[0]
    const { slots } = await getSlotsDisponiveis(dataStr)
    if (slots.length > 0) {
      datasDisponiveis.push(dataStr)
    }
  }

  return datasDisponiveis
}
