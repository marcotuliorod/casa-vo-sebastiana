import { and, eq, gte, inArray, isNull, lt, ne, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { eventos, agendamentos } from '@/lib/db/schema'
import { formatInTimeZone } from 'date-fns-tz'
import { expandirOcorrencias } from '@/lib/utils/recorrencia'
import type { Evento, OcorrenciaEvento } from '@/types/database'

const FUSO_BR = 'America/Sao_Paulo'

function mapEvento(e: typeof eventos.$inferSelect): Evento {
  return {
    id: e.id,
    titulo: e.titulo,
    descricao: e.descricao,
    data_inicio: e.dataInicio,
    hora_inicio: e.horaInicio,
    hora_fim: e.horaFim,
    capacidade: e.capacidade,
    recorrencia: e.recorrencia,
    data_fim_recorrencia: e.dataFimRecorrencia,
    lembrete_horas: e.lembreteHoras,
    ativo: e.ativo,
    criado_em: e.criadoEm.toISOString(),
    atualizado_em: e.atualizadoEm.toISOString(),
  }
}

/** Todos os eventos — para o painel admin */
export async function listarEventos(): Promise<Evento[]> {
  const linhas = await db.select().from(eventos).orderBy(eventos.dataInicio)
  return linhas.map(mapEvento)
}

/** Eventos ativos com ocorrências futuras — para o fluxo público */
export async function listarEventosAtivos(): Promise<Evento[]> {
  const hojeStr = formatInTimeZone(new Date(), FUSO_BR, 'yyyy-MM-dd')

  // Inclui: recorrentes sem fim OU com data_fim >= hoje OU evento único >= hoje
  const semFimOuFuturo = or(isNull(eventos.dataFimRecorrencia), gte(eventos.dataFimRecorrencia, hojeStr))

  const futuros = await db
    .select()
    .from(eventos)
    .where(and(eq(eventos.ativo, true), semFimOuFuturo, gte(eventos.dataInicio, hojeStr)))
    .orderBy(eventos.dataInicio)

  // Para recorrentes com data_inicio passada mas ainda com ocorrências futuras,
  // a query acima pode perder (pois data_inicio < hoje). Segunda query sem o filtro de data_inicio:
  const recorrentesPassados = await db
    .select()
    .from(eventos)
    .where(
      and(
        eq(eventos.ativo, true),
        ne(eventos.recorrencia, 'nenhuma'),
        semFimOuFuturo,
        lt(eventos.dataInicio, hojeStr)
      )
    )

  const todos = [...futuros, ...recorrentesPassados]
  // Deduplica por id
  const mapa = new Map(todos.map((e) => [e.id, e]))
  // Filtra apenas os que têm pelo menos uma ocorrência futura
  return Array.from(mapa.values())
    .filter((evento) => {
      const ocorrencias = expandirOcorrencias({
        data_inicio: evento.dataInicio,
        recorrencia: evento.recorrencia,
        data_fim_recorrencia: evento.dataFimRecorrencia,
      })
      return ocorrencias.length > 0
    })
    .map(mapEvento)
}

/** Evento por ID */
export async function getEvento(id: string): Promise<Evento | null> {
  const [linha] = await db.select().from(eventos).where(eq(eventos.id, id)).limit(1)
  return linha ? mapEvento(linha) : null
}

/**
 * Expande um evento em ocorrências futuras, enriquecidas com contagem de inscritos.
 * 1 query para buscar contagens de todos as datas de uma vez.
 */
export async function getOcorrenciasEvento(evento: Evento): Promise<OcorrenciaEvento[]> {
  const datas = expandirOcorrencias({
    data_inicio: evento.data_inicio,
    recorrencia: evento.recorrencia,
    data_fim_recorrencia: evento.data_fim_recorrencia,
  })

  if (!datas.length) return []

  // Conta inscritos ativos (pendente + confirmado) por data, numa única query
  const inscricoes = await db
    .select({ dataAgendada: agendamentos.dataAgendada })
    .from(agendamentos)
    .where(
      and(
        eq(agendamentos.eventoId, evento.id),
        inArray(agendamentos.dataAgendada, datas),
        inArray(agendamentos.status, ['pendente', 'confirmado'])
      )
    )

  const contagemPorData = new Map<string, number>()
  for (const row of inscricoes) {
    contagemPorData.set(row.dataAgendada, (contagemPorData.get(row.dataAgendada) ?? 0) + 1)
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
  const linhas = await db
    .select({ id: agendamentos.id })
    .from(agendamentos)
    .where(
      and(
        eq(agendamentos.eventoId, eventoId),
        eq(agendamentos.dataAgendada, data),
        inArray(agendamentos.status, ['pendente', 'confirmado'])
      )
    )

  return linhas.length
}
