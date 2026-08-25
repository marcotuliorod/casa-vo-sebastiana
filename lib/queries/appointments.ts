// Queries de agendamentos para o painel admin e área pública

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { and, asc, count, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, clientes } from '@/lib/db/schema'
import { mapAgendamentoComCliente } from '@/lib/db/mappers'
import type { AppointmentStatus } from '@/types/database'

const TZ = 'America/Sao_Paulo'

// Buscar agendamento pelo token público (sem login)
export async function getAgendamentoPorToken(token: string) {
  const linha = await db.query.agendamentos.findFirst({
    where: eq(agendamentos.tokenPublico, token),
    with: { cliente: true },
  })

  return linha ? mapAgendamentoComCliente(linha) : null
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
  const condicoes = []

  if (filtros?.data) {
    condicoes.push(eq(agendamentos.dataAgendada, filtros.data))
  }

  if (filtros?.periodo) {
    const agora = new Date()
    const hoje = formatInTimeZone(agora, TZ, 'yyyy-MM-dd')
    switch (filtros.periodo) {
      case 'hoje':
        condicoes.push(eq(agendamentos.dataAgendada, hoje))
        break
      case '7dias': {
        const daqui7 = formatInTimeZone(new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd')
        condicoes.push(gte(agendamentos.dataAgendada, hoje), lte(agendamentos.dataAgendada, daqui7))
        break
      }
      case 'semana': {
        const dia = agora.getDay()
        const offsetSeg = dia === 0 ? -6 : 1 - dia
        const segunda = new Date(agora)
        segunda.setDate(agora.getDate() + offsetSeg)
        const domingo = new Date(segunda)
        domingo.setDate(segunda.getDate() + 6)
        condicoes.push(
          gte(agendamentos.dataAgendada, formatInTimeZone(segunda, TZ, 'yyyy-MM-dd')),
          lte(agendamentos.dataAgendada, formatInTimeZone(domingo, TZ, 'yyyy-MM-dd'))
        )
        break
      }
      case 'mes': {
        const mesInicio = formatInTimeZone(agora, TZ, 'yyyy-MM') + '-01'
        const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)
        const mesFim = formatInTimeZone(new Date(proximoMes.getTime() - 1), TZ, 'yyyy-MM-dd')
        condicoes.push(gte(agendamentos.dataAgendada, mesInicio), lte(agendamentos.dataAgendada, mesFim))
        break
      }
    }
  }

  if (filtros?.status) {
    condicoes.push(eq(agendamentos.status, filtros.status))
  }

  if (filtros?.busca) {
    const buscaSegura = filtros.busca
      .slice(0, 50)
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
    const padrao = `%${buscaSegura}%`

    // Resolve primeiro os clientes que batem (nome ou telefone), depois filtra
    // agendamentos por cliente_id — equivalente ao .or(..., {foreignTable}) do supabase-js.
    const clientesEncontrados = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(or(ilike(clientes.nome, padrao), ilike(clientes.telefone, padrao)))

    condicoes.push(inArray(agendamentos.clienteId, clientesEncontrados.map((c) => c.id)))
  }

  if (filtros?.medium_id) {
    condicoes.push(eq(agendamentos.mediumId, filtros.medium_id))
  }

  if (filtros?.tipo === 'evento') {
    condicoes.push(isNotNull(agendamentos.eventoId))
  } else if (filtros?.tipo === 'horario') {
    condicoes.push(isNull(agendamentos.eventoId))
  }

  const linhas = await db.query.agendamentos.findMany({
    where: condicoes.length ? and(...condicoes) : undefined,
    with: { cliente: true },
    orderBy: [asc(agendamentos.dataAgendada), asc(agendamentos.horaInicio)],
  })

  return linhas.map(mapAgendamentoComCliente)
}

// Estatísticas para o dashboard
export async function getEstatisticas() {
  const agora = new Date()
  const hoje = formatInTimeZone(agora, TZ, 'yyyy-MM-dd')
  const daqui7 = formatInTimeZone(new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd')
  const inicioMes = fromZonedTime(`${formatInTimeZone(agora, TZ, 'yyyy-MM')}-01T00:00:00`, TZ)

  const [[hojeCount], [semanaCount], [mesCount], [totalClientes], [pendentesCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(agendamentos)
      .where(and(eq(agendamentos.dataAgendada, hoje), ne(agendamentos.status, 'cancelado'))),

    db
      .select({ value: count() })
      .from(agendamentos)
      .where(
        and(
          gte(agendamentos.dataAgendada, hoje),
          lte(agendamentos.dataAgendada, daqui7),
          ne(agendamentos.status, 'cancelado')
        )
      ),

    db
      .select({ value: count() })
      .from(agendamentos)
      .where(and(gte(agendamentos.criadoEm, inicioMes), ne(agendamentos.status, 'cancelado'))),

    db.select({ value: count() }).from(clientes),

    db.select({ value: count() }).from(agendamentos).where(eq(agendamentos.status, 'pendente')),
  ])

  return {
    hoje: hojeCount?.value ?? 0,
    semana: semanaCount?.value ?? 0,
    mes: mesCount?.value ?? 0,
    totalClientes: totalClientes?.value ?? 0,
    pendentes: pendentesCount?.value ?? 0,
  }
}

// Histórico de agendamentos do consulente (por telefone normalizado)
export async function getHistoricoCliente(telefone: string) {
  const [cliente] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.telefone, telefone))
    .limit(1)

  if (!cliente) return []

  const linhas = await db.query.agendamentos.findMany({
    where: eq(agendamentos.clienteId, cliente.id),
    with: { cliente: true },
    orderBy: (a, { desc }) => [desc(a.dataAgendada)],
  })

  return linhas.map(mapAgendamentoComCliente)
}

// Agendamentos para o cron de lembretes
export async function getAgendamentosParaLembrete(data: string) {
  const linhas = await db.query.agendamentos.findMany({
    where: and(
      eq(agendamentos.dataAgendada, data),
      eq(agendamentos.status, 'confirmado'),
      eq(agendamentos.lembreteEnviado, false)
    ),
    with: { cliente: true },
  })

  return linhas.map(mapAgendamentoComCliente)
}
