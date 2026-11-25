// Informações da Casa contra Postgres real: a tabela aceita uma linha só (id = 1)
// e getInfoCasa lê o que foi salvo.
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).
// Guarda e restaura a linha existente, para não apagar dados de um banco de desenvolvimento.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '@/lib/db/schema'
import { getInfoCasa } from '@/lib/queries/casa'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('informações da Casa — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  let original: (typeof schema.configuracoesCasa.$inferSelect)[] = []

  beforeAll(async () => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })
    original = await db.select().from(schema.configuracoesCasa)
    await db.delete(schema.configuracoesCasa)
  })

  afterAll(async () => {
    await db.delete(schema.configuracoesCasa)
    if (original.length) await db.insert(schema.configuracoesCasa).values(original)
    await client.end()
  })

  it('sem nada salvo, devolve tudo vazio', async () => {
    const info = await getInfoCasa()
    expect(info.endereco).toBeNull()
    expect(info.responsavelDados).toBeNull()
  })

  it('lê o que foi salvo', async () => {
    await db.insert(schema.configuracoesCasa).values({ id: 1, endereco: 'Rua das Flores, 10', orientacoes: 'Chegue cedo.' })
    const info = await getInfoCasa()
    expect(info.endereco).toBe('Rua das Flores, 10')
    expect(info.orientacoes).toBe('Chegue cedo.')
  })

  it('não aceita uma segunda linha', async () => {
    await expect(db.insert(schema.configuracoesCasa).values({ id: 2, endereco: 'Outra' })).rejects.toThrow()
  })
})
