import { createAdminClient } from '@/lib/supabase/server'
import { expandirOcorrencias } from '@/lib/utils/recorrencia'

export type ContagensPorDia = Record<string, { agendamentos: number; eventos: number }>

export async function getContagensPorDia(
  dataInicio: string,
  dataFim: string
): Promise<ContagensPorDia> {
  const supabase = createAdminClient()

  const [{ data: agendamentos }, { data: eventos }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('data_agendada')
      .gte('data_agendada', dataInicio)
      .lte('data_agendada', dataFim)
      .neq('status', 'cancelado'),
    supabase
      .from('eventos')
      .select('data_inicio, recorrencia, data_fim_recorrencia')
      .eq('ativo', true),
  ])

  // Contagem de agendamentos por dia
  const mapaAg = new Map<string, number>()
  for (const ag of agendamentos ?? []) {
    mapaAg.set(ag.data_agendada, (mapaAg.get(ag.data_agendada) ?? 0) + 1)
  }

  // Expandir ocorrências de eventos e filtrar pelo intervalo
  const mapaEv = new Map<string, number>()
  for (const ev of eventos ?? []) {
    const ocorrencias = expandirOcorrencias({
      data_inicio: ev.data_inicio,
      recorrencia: ev.recorrencia,
      data_fim_recorrencia: ev.data_fim_recorrencia,
      limite: 104,
    })
    for (const data of ocorrencias) {
      if (data >= dataInicio && data <= dataFim) {
        mapaEv.set(data, (mapaEv.get(data) ?? 0) + 1)
      }
    }
  }

  const resultado: ContagensPorDia = {}
  const todasDatas = Array.from(
    new Set(Array.from(mapaAg.keys()).concat(Array.from(mapaEv.keys())))
  )
  for (const data of todasDatas) {
    resultado[data] = {
      agendamentos: mapaAg.get(data) ?? 0,
      eventos: mapaEv.get(data) ?? 0,
    }
  }
  return resultado
}
