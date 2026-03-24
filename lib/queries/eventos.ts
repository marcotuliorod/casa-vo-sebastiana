import { createAdminClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { expandirOcorrencias } from '@/lib/utils/recorrencia'
import type { Evento, OcorrenciaEvento } from '@/types/database'

const FUSO_BR = 'America/Sao_Paulo'

/** Todos os eventos — para o painel admin */
export async function listarEventos(): Promise<Evento[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('eventos')
    .select('*')
    .order('data_inicio', { ascending: true })

  return (data ?? []) as Evento[]
}

/** Eventos ativos com ocorrências futuras — para o fluxo público */
export async function listarEventosAtivos(): Promise<Evento[]> {
  const supabase = createAdminClient()
  const hojeStr = formatInTimeZone(new Date(), FUSO_BR, 'yyyy-MM-dd')

  const { data } = await supabase
    .from('eventos')
    .select('*')
    .eq('ativo', true)
    // Inclui: recorrentes sem fim OU com data_fim >= hoje OU evento único >= hoje
    .or(`data_fim_recorrencia.is.null,data_fim_recorrencia.gte.${hojeStr}`)
    .gte('data_inicio', hojeStr) // filtra eventos únicos passados (recorrentes passados são filtrados na engine)
    .order('data_inicio', { ascending: true })

  // Para recorrentes com data_inicio passada mas ainda com ocorrências futuras,
  // a query acima pode perder (pois data_inicio < hoje). Fazemos segunda query sem o filtro de data_inicio:
  const { data: recorrentes } = await supabase
    .from('eventos')
    .select('*')
    .eq('ativo', true)
    .neq('recorrencia', 'nenhuma')
    .or(`data_fim_recorrencia.is.null,data_fim_recorrencia.gte.${hojeStr}`)
    .lt('data_inicio', hojeStr)

  const todos = [...(data ?? []), ...(recorrentes ?? [])] as Evento[]
  // Deduplica por id
  const mapa = new Map(todos.map((e) => [e.id, e]))
  // Filtra apenas os que têm pelo menos uma ocorrência futura
  return Array.from(mapa.values()).filter((evento) => {
    const ocorrencias = expandirOcorrencias({
      data_inicio: evento.data_inicio,
      recorrencia: evento.recorrencia,
      data_fim_recorrencia: evento.data_fim_recorrencia,
    })
    return ocorrencias.length > 0
  })
}

/** Evento por ID */
export async function getEvento(id: string): Promise<Evento | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('eventos')
    .select('*')
    .eq('id', id)
    .single()

  return (data as Evento) ?? null
}

/**
 * Expande um evento em ocorrências futuras, enriquecidas com contagem de inscritos.
 * 1 query para buscar contagens de todos as datas de uma vez.
 */
export async function getOcorrenciasEvento(evento: Evento): Promise<OcorrenciaEvento[]> {
  const supabase = createAdminClient()

  const datas = expandirOcorrencias({
    data_inicio: evento.data_inicio,
    recorrencia: evento.recorrencia,
    data_fim_recorrencia: evento.data_fim_recorrencia,
  })

  if (!datas.length) return []

  // Conta inscritos ativos (pendente + confirmado) por data, numa única query
  const { data: inscricoes } = await supabase
    .from('agendamentos')
    .select('data_agendada')
    .eq('evento_id', evento.id)
    .in('data_agendada', datas)
    .in('status', ['pendente', 'confirmado'])

  const contagemPorData = new Map<string, number>()
  for (const row of (inscricoes ?? [])) {
    const chave = row.data_agendada as string
    contagemPorData.set(chave, (contagemPorData.get(chave) ?? 0) + 1)
  }

  return datas.map((data) => {
    const inscritos = contagemPorData.get(data) ?? 0
    return {
      evento,
      data,
      inscritos,
      vagasRestantes: Math.max(0, evento.capacidade - inscritos),
    }
  })
}

/**
 * Conta inscritos ativos numa ocorrência específica.
 * Usado no check de capacidade antes de inserir uma inscrição.
 */
export async function contarInscritosOcorrencia(
  eventoId: string,
  data: string
): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('agendamentos')
    .select('*', { count: 'exact', head: true })
    .eq('evento_id', eventoId)
    .eq('data_agendada', data)
    .in('status', ['pendente', 'confirmado'])

  return count ?? 0
}
