import { and, eq, gte, lte, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, eventos } from '@/lib/db/schema'
import { expandirOcorrencias } from '@/lib/utils/recorrencia'

export type ContagensPorDia = Record<string, { agendamentos: number; eventos: number }>

export async function getContagensPorDia(
  dataInicio: string,
  dataFim: string
): Promise<ContagensPorDia> {
  const [listaAgendamentos, listaEventos] = await Promise.all([
    db
      .select({ dataAgendada: agendamentos.dataAgendada })
      .from(agendamentos)
      .where(
        and(
          gte(agendamentos.dataAgendada, dataInicio),
          lte(agendamentos.dataAgendada, dataFim),
          ne(agendamentos.status, 'cancelado')
        )
      ),
    db
      .select({
        dataInicio: eventos.dataInicio,
        recorrencia: eventos.recorrencia,
        dataFimRecorrencia: eventos.dataFimRecorrencia,
      })
      .from(eventos)
      .where(eq(eventos.ativo, true)),
  ])

  // Contagem de agendamentos por dia
  const mapaAg = new Map<string, number>()
  for (const ag of listaAgendamentos ?? []) {
    mapaAg.set(ag.dataAgendada, (mapaAg.get(ag.dataAgendada) ?? 0) + 1)
  }

  // Expandir ocorrências de eventos e filtrar pelo intervalo
  const mapaEv = new Map<string, number>()
  for (const ev of listaEventos ?? []) {
    const ocorrencias = expandirOcorrencias({
      data_inicio: ev.dataInicio,
      recorrencia: ev.recorrencia,
      data_fim_recorrencia: ev.dataFimRecorrencia,
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
