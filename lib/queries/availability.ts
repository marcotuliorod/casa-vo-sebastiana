// Queries de disponibilidade — calcula slots disponíveis para uma data

import { and, eq, gte, inArray, isNull } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import { db } from '@/lib/db'
import { gradeHorarios, datasBloqueadas, agendamentos } from '@/lib/db/schema'
import { diaDaSemana } from '@/lib/utils/date'
import type { SlotDisponivel } from '@/types/database'

const FUSO_BR = 'America/Sao_Paulo'

interface ResultadoDisponibilidade {
  slots: SlotDisponivel[]
  erro?: string
}

export async function getSlotsDisponiveis(data: string): Promise<ResultadoDisponibilidade> {
  const diaSemana = diaDaSemana(data)

  // 1. Buscar grade de horários do dia da semana
  let grade
  try {
    grade = await db
      .select()
      .from(gradeHorarios)
      .where(and(eq(gradeHorarios.diaSemana, diaSemana), eq(gradeHorarios.ativo, true)))
      .orderBy(gradeHorarios.horaInicio)
  } catch (erro) {
    return { slots: [], erro: erro instanceof Error ? erro.message : 'Erro desconhecido' }
  }
  if (!grade.length) return { slots: [] }

  // 2. Verificar se o dia inteiro está bloqueado
  const bloqueios = await db
    .select()
    .from(datasBloqueadas)
    .where(eq(datasBloqueadas.dataBloqueada, data))

  const diaBloqueado = bloqueios.some((b) => b.horaInicio === null)
  if (diaBloqueado) return { slots: [] }

  const horariosBloqueados = new Set(
    bloqueios.filter((b) => b.horaInicio !== null).map((b) => b.horaInicio)
  )

  // 3. Buscar agendamentos já ocupados para esta data
  const agendados = await db
    .select({ horaInicio: agendamentos.horaInicio })
    .from(agendamentos)
    .where(
      and(
        eq(agendamentos.dataAgendada, data),
        inArray(agendamentos.status, ['pendente', 'confirmado'])
      )
    )

  const horariosOcupados = new Set(agendados.map((a) => a.horaInicio))

  // 4. Filtrar slots disponíveis
  const slotsDisponiveis: SlotDisponivel[] = grade
    .filter(
      (slot) =>
        !horariosBloqueados.has(slot.horaInicio) && !horariosOcupados.has(slot.horaInicio)
    )
    .map((slot) => ({
      hora_inicio: slot.horaInicio.slice(0, 5), // BUG-08: normaliza HH:MM:SS → HH:MM
      hora_fim: slot.horaFim.slice(0, 5),
    }))

  return { slots: slotsDisponiveis }
}

// Retorna as datas com bloqueio de dia inteiro (hora_inicio IS NULL)
// Usado pelo calendário para desabilitar visualmente as datas bloqueadas
export async function getDatasBlockeadas(): Promise<string[]> {
  const hoje = formatInTimeZone(new Date(), FUSO_BR, 'yyyy-MM-dd') // BUG-B: usa fuso BR, não UTC

  try {
    const bloqueios = await db
      .select({ dataBloqueada: datasBloqueadas.dataBloqueada })
      .from(datasBloqueadas)
      .where(and(isNull(datasBloqueadas.horaInicio), gte(datasBloqueadas.dataBloqueada, hoje)))

    return bloqueios.map((b) => b.dataBloqueada)
  } catch (erro) {
    console.error('getDatasBlockeadas:', erro)
    return []
  }
}

// Retorna os dias da semana com pelo menos 1 slot ativo na grade
// Usado pelo calendário para mostrar apenas dias configurados (BUG-03)
export async function getDiasAtivos(): Promise<number[]> {
  const grade = await db
    .select({ diaSemana: gradeHorarios.diaSemana })
    .from(gradeHorarios)
    .where(eq(gradeHorarios.ativo, true))

  return [...new Set(grade.map((g) => g.diaSemana))]
}

// Retorna quais datas têm pelo menos 1 slot disponível — O(3 queries) (US-11 / BUG-04)
export async function getDatasComSlotsDisponiveis(datas: string[]): Promise<string[]> {
  if (!datas.length) return []

  // 1. Todos os slots ativos por dia da semana
  const gradeData = await db
    .select({ diaSemana: gradeHorarios.diaSemana, horaInicio: gradeHorarios.horaInicio })
    .from(gradeHorarios)
    .where(eq(gradeHorarios.ativo, true))

  const slotsPorDia = new Map<number, Set<string>>()
  for (const g of gradeData) {
    if (!slotsPorDia.has(g.diaSemana)) slotsPorDia.set(g.diaSemana, new Set())
    slotsPorDia.get(g.diaSemana)!.add(g.horaInicio)
  }

  // 2. Bloqueios (totais e parciais) no período
  const bloqueiosData = await db
    .select({ dataBloqueada: datasBloqueadas.dataBloqueada, horaInicio: datasBloqueadas.horaInicio })
    .from(datasBloqueadas)
    .where(inArray(datasBloqueadas.dataBloqueada, datas))

  const bloqueiosPorData = new Map<string, Set<string | null>>()
  for (const b of bloqueiosData) {
    if (!bloqueiosPorData.has(b.dataBloqueada)) bloqueiosPorData.set(b.dataBloqueada, new Set())
    bloqueiosPorData.get(b.dataBloqueada)!.add(b.horaInicio)
  }

  // 3. Agendamentos ocupados no período
  const agendadosData = await db
    .select({ dataAgendada: agendamentos.dataAgendada, horaInicio: agendamentos.horaInicio })
    .from(agendamentos)
    .where(
      and(
        inArray(agendamentos.dataAgendada, datas),
        inArray(agendamentos.status, ['pendente', 'confirmado'])
      )
    )

  const ocupadosPorData = new Map<string, Set<string>>()
  for (const a of agendadosData) {
    if (!ocupadosPorData.has(a.dataAgendada)) ocupadosPorData.set(a.dataAgendada, new Set())
    ocupadosPorData.get(a.dataAgendada)!.add(a.horaInicio)
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
  const ocupados = await db
    .select({ id: agendamentos.id })
    .from(agendamentos)
    .where(
      and(
        eq(agendamentos.dataAgendada, data),
        eq(agendamentos.horaInicio, horaInicio),
        eq(agendamentos.horaFim, horaFim),
        inArray(agendamentos.status, ['pendente', 'confirmado'])
      )
    )

  return ocupados.length === 0
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
