// Lembretes e novos tipos de e-mail contra Postgres real:
// - o lembrete da véspera (atendimentos) não pega inscrições em eventos, que têm lembrete próprio;
// - a migration 0003 aceita os tipos de e-mail "confirmacao_casa" e "alteracao".
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, inArray, like } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { getAgendamentosParaLembrete } from '@/lib/queries/appointments'

const DATABASE_URL = process.env.DATABASE_URL
const DATA = '2032-03-15'

describe.skipIf(!DATABASE_URL)('lembretes e tipos de e-mail — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  const marcador = `TESTE_LEMB_${Date.now()}_`
  let eventoId: string
  let atendimentoId: string
  let inscricaoId: string

  beforeAll(async () => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })

    const [cliente] = await db
      .insert(schema.clientes)
      .values({ nome: 'Maria', telefone: `${marcador}1`, email: `${marcador.toLowerCase()}maria@exemplo.com` })
      .returning()
    const [evento] = await db
      .insert(schema.eventos)
      .values({ titulo: `${marcador}Gira`, dataInicio: DATA, horaInicio: '19:00', horaFim: '21:00' })
      .returning()
    eventoId = evento.id

    const [atendimento, inscricao] = await db
      .insert(schema.agendamentos)
      .values([
        { clienteId: cliente.id, dataAgendada: DATA, horaInicio: '09:00', horaFim: '09:30', status: 'confirmado' },
        {
          clienteId: cliente.id,
          eventoId,
          dataAgendada: DATA,
          horaInicio: '19:00',
          horaFim: '21:00',
          status: 'confirmado',
        },
      ])
      .returning()
    atendimentoId = atendimento.id
    inscricaoId = inscricao.id
  })

  afterAll(async () => {
    const ids = (
      await db
        .select({ id: schema.clientes.id })
        .from(schema.clientes)
        .where(like(schema.clientes.telefone, `${marcador}%`))
    ).map((c) => c.id)
    if (ids.length) {
      await db.delete(schema.emailQueue).where(inArray(schema.emailQueue.agendamentoId, [atendimentoId, inscricaoId]))
      await db.delete(schema.agendamentos).where(inArray(schema.agendamentos.clienteId, ids))
      await db.delete(schema.clientes).where(inArray(schema.clientes.id, ids))
    }
    if (eventoId) await db.delete(schema.eventos).where(eq(schema.eventos.id, eventoId))
    await client.end()
  })

  it('o lembrete da véspera traz o atendimento e deixa de fora a inscrição no evento', async () => {
    const lista = await getAgendamentosParaLembrete(DATA)
    const ids = lista.map((a) => a.id)
    expect(ids).toContain(atendimentoId)
    expect(ids).not.toContain(inscricaoId)
  })

  it('aceita os novos tipos de e-mail no log e na fila de reenvio', async () => {
    await db.insert(schema.logsEmail).values([
      { agendamentoId: atendimentoId, evento: 'confirmacao_casa', paraEmail: 'x@exemplo.com', assunto: 'a', status: 'enviado' },
      { agendamentoId: atendimentoId, evento: 'alteracao', paraEmail: 'x@exemplo.com', assunto: 'a', status: 'enviado' },
    ])
    await db.insert(schema.emailQueue).values([
      { agendamentoId: atendimentoId, destinatarios: 'x@exemplo.com', assunto: 'a', texto: 't', html: 'h', tipo: 'confirmacao_casa' },
      { agendamentoId: atendimentoId, destinatarios: 'x@exemplo.com', assunto: 'a', texto: 't', html: 'h', tipo: 'alteracao' },
    ])

    const logs = await db
      .select({ evento: schema.logsEmail.evento })
      .from(schema.logsEmail)
      .where(eq(schema.logsEmail.agendamentoId, atendimentoId))
    expect(logs.map((l) => l.evento).sort()).toEqual(['alteracao', 'confirmacao_casa'])
  })
})
