// "Meus Agendamentos" contra Postgres real: a busca por e-mail não diferencia
// maiúsculas (cadastros antigos guardaram o e-mail como foi digitado), junta
// os consulentes que compartilham o e-mail e não vaza agendamentos de outros.
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { inArray, like } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { getHistoricoPorEmail, getNomeClientePorEmail } from '@/lib/queries/appointments'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('histórico por e-mail — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  const marcador = `TESTE_HIST_${Date.now()}_`
  const email = `${marcador.toLowerCase()}maria@exemplo.com`

  beforeAll(async () => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })

    const [celular, fixo, outra] = await db
      .insert(schema.clientes)
      .values([
        { nome: 'Maria (celular)', telefone: `${marcador}1`, email },
        // mesmo e-mail, outro telefone, gravado com maiúsculas
        { nome: 'Maria (fixo)', telefone: `${marcador}2`, email: email.toUpperCase() },
        { nome: 'Outra pessoa', telefone: `${marcador}3`, email: `${marcador.toLowerCase()}outra@exemplo.com` },
      ])
      .returning()

    await db.insert(schema.agendamentos).values([
      { clienteId: celular.id, dataAgendada: '2031-07-01', horaInicio: '09:00', horaFim: '09:30', status: 'confirmado' },
      { clienteId: fixo.id, dataAgendada: '2031-07-02', horaInicio: '10:00', horaFim: '10:30', status: 'pendente' },
      { clienteId: outra.id, dataAgendada: '2031-07-03', horaInicio: '11:00', horaFim: '11:30', status: 'pendente' },
    ])
  })

  afterAll(async () => {
    const ids = (
      await db
        .select({ id: schema.clientes.id })
        .from(schema.clientes)
        .where(like(schema.clientes.telefone, `${marcador}%`))
    ).map((c) => c.id)
    if (ids.length) {
      await db.delete(schema.agendamentos).where(inArray(schema.agendamentos.clienteId, ids))
      await db.delete(schema.clientes).where(inArray(schema.clientes.id, ids))
    }
    await client.end()
  })

  it('junta os agendamentos de todos os cadastros com o e-mail, ignorando maiúsculas', async () => {
    const historico = await getHistoricoPorEmail(` ${email.toUpperCase()} `)
    expect(historico.map((a) => a.data_agendada)).toEqual(['2031-07-02', '2031-07-01'])
  })

  it('não devolve agendamentos de outro e-mail', async () => {
    const historico = await getHistoricoPorEmail(email)
    expect(historico).toHaveLength(2)
    expect(historico.every((a) => a.clientes.nome.startsWith('Maria'))).toBe(true)
  })

  it('e-mail sem cadastro devolve lista vazia e nome null', async () => {
    expect(await getHistoricoPorEmail(`${marcador.toLowerCase()}ninguem@exemplo.com`)).toEqual([])
    expect(await getNomeClientePorEmail(`${marcador.toLowerCase()}ninguem@exemplo.com`)).toBeNull()
  })

  it('getNomeClientePorEmail encontra o consulente pelo e-mail', async () => {
    expect(await getNomeClientePorEmail(email.toUpperCase())).toMatch(/^Maria/)
  })
})
