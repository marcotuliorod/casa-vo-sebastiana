// Queries de médiuns

import { and, asc, eq, gte, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mediuns, agendamentos } from '@/lib/db/schema'
import { mapMedium, mapAgendamentoComCliente } from '@/lib/db/mappers'
import type { Medium, AgendamentoComCliente } from '@/types/database'

// Listar todos os médiuns (admin)
export async function listarMediuns(): Promise<Medium[]> {
  const linhas = await db.select().from(mediuns).orderBy(asc(mediuns.nome))
  return linhas.map(mapMedium)
}

// Buscar médium pelo token de acesso (página pública)
export async function getMediumPorToken(token: string): Promise<Medium | null> {
  const [linha] = await db
    .select()
    .from(mediuns)
    .where(and(eq(mediuns.tokenAcesso, token), eq(mediuns.ativo, true)))
    .limit(1)

  return linha ? mapMedium(linha) : null
}

// Agendamentos já atribuídos ao médium (a partir de hoje)
export async function getAgendamentosDoMedium(
  mediumId: string
): Promise<AgendamentoComCliente[]> {
  const hoje = new Date().toISOString().split('T')[0]

  const linhas = await db.query.agendamentos.findMany({
    where: and(
      eq(agendamentos.mediumId, mediumId),
      gte(agendamentos.dataAgendada, hoje),
      inArray(agendamentos.status, ['pendente', 'confirmado'])
    ),
    with: { cliente: true },
    orderBy: [asc(agendamentos.dataAgendada), asc(agendamentos.horaInicio)],
  })

  return linhas.map(mapAgendamentoComCliente)
}

// Mapa de id → nome para múltiplos médiuns (batch, para histórico do consulente)
export async function getMediunsNomesMap(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}

  const linhas = await db
    .select({ id: mediuns.id, nome: mediuns.nome })
    .from(mediuns)
    .where(inArray(mediuns.id, ids))

  const mapa: Record<string, string> = {}
  for (const m of linhas) mapa[m.id] = m.nome
  return mapa
}

// Buscar nome de um médium pelo id — para exibição na confirmação pública (US-10)
export async function getMediumNome(id: string): Promise<string | null> {
  const [linha] = await db
    .select({ nome: mediuns.nome })
    .from(mediuns)
    .where(eq(mediuns.id, id))
    .limit(1)

  return linha?.nome ?? null
}

// Agendamentos sem médium atribuído — disponíveis para assumir
export async function getAgendamentosDisponiveisMedium(): Promise<AgendamentoComCliente[]> {
  const hoje = new Date().toISOString().split('T')[0]

  const linhas = await db.query.agendamentos.findMany({
    where: and(
      isNull(agendamentos.mediumId),
      gte(agendamentos.dataAgendada, hoje),
      inArray(agendamentos.status, ['pendente', 'confirmado'])
    ),
    with: { cliente: true },
    orderBy: [asc(agendamentos.dataAgendada), asc(agendamentos.horaInicio)],
  })

  return linhas.map(mapAgendamentoComCliente)
}
