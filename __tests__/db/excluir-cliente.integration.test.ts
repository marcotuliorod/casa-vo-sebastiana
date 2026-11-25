// excluirCliente contra Postgres real: agendamentos.cliente_id é ON DELETE
// RESTRICT, então a exclusão (pedido de apagar dados, LGPD) só funciona se o
// histórico sair antes — e logs_email precisa cair junto.
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(async () => ({ user: { email: 'admin@exemplo.com' } })),
}))

import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, inArray, like } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { excluirCliente } from '@/lib/actions/admin'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('excluirCliente — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  const marcador = `TESTE_EXCL_${Date.now()}_`
  const adminsOriginais = process.env.ADMIN_EMAILS

  beforeAll(() => {
    process.env.ADMIN_EMAILS = 'admin@exemplo.com'
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })
  })

  afterAll(async () => {
    process.env.ADMIN_EMAILS = adminsOriginais
    const ids = (
      await db.select({ id: schema.clientes.id }).from(schema.clientes).where(like(schema.clientes.telefone, `${marcador}%`))
    ).map((c) => c.id)
    if (ids.length) {
      await db.delete(schema.agendamentos).where(inArray(schema.agendamentos.clienteId, ids))
      await db.delete(schema.clientes).where(inArray(schema.clientes.id, ids))
    }
    await client.end()
  })

  it('apaga consulente com histórico, incluindo os logs de e-mail', async () => {
    const [cli] = await db
      .insert(schema.clientes)
      .values({ nome: 'Para excluir', telefone: `${marcador}1`, email: 'excluir@exemplo.com' })
      .returning()
    const [ag] = await db
      .insert(schema.agendamentos)
      .values({ clienteId: cli.id, dataAgendada: '2020-01-10', horaInicio: '09:00', horaFim: '09:30', status: 'realizado' })
      .returning()
    await db.insert(schema.logsEmail).values({
      agendamentoId: ag.id,
      evento: 'confirmacao_agendamento',
      paraEmail: 'excluir@exemplo.com',
      assunto: 'x',
      status: 'enviado',
    })

    expect(await excluirCliente(cli.id)).toEqual({})

    expect(await db.select().from(schema.clientes).where(eq(schema.clientes.id, cli.id))).toEqual([])
    expect(await db.select().from(schema.agendamentos).where(eq(schema.agendamentos.clienteId, cli.id))).toEqual([])
    expect(await db.select().from(schema.logsEmail).where(eq(schema.logsEmail.agendamentoId, ag.id))).toEqual([])
  })

  it('não apaga nada quando há agendamento ativo', async () => {
    const [cli] = await db
      .insert(schema.clientes)
      .values({ nome: 'Ativo', telefone: `${marcador}2` })
      .returning()
    await db.insert(schema.agendamentos).values([
      { clienteId: cli.id, dataAgendada: '2020-01-11', horaInicio: '09:00', horaFim: '09:30', status: 'realizado' },
      { clienteId: cli.id, dataAgendada: '2031-01-11', horaInicio: '10:00', horaFim: '10:30', status: 'confirmado' },
    ])

    expect((await excluirCliente(cli.id)).erro).toMatch(/1 agendamento/)
    expect(await db.select().from(schema.agendamentos).where(eq(schema.agendamentos.clienteId, cli.id))).toHaveLength(2)
  })
})
