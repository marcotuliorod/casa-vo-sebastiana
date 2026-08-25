// Teste de integração contra Postgres real para os dois padrões mais novos
// introduzidos na tradução de lib/actions/admin.ts para Drizzle, que os
// testes mockados não conseguem validar de verdade:
//   1. onConflictDoUpdate (upsert da grade de horários) — sintaxe
//      `sql`excluded.coluna`` num upsert em lote.
//   2. codigoPg() extraindo 23505 (unique_violation) de um erro real do
//      driver `postgres` — já validamos 23P01 na Fase 1, mas não 23505.
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { codigoPg } from '@/lib/db/errors'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('actions — padrões novos, integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  const diaTeste = 1 // segunda-feira — dia isolado, não usado por outros testes

  beforeAll(() => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })
  })

  afterAll(async () => {
    await db.delete(schema.gradeHorarios).where(eq(schema.gradeHorarios.diaSemana, diaTeste))
    await client.end()
  })

  it('onConflictDoUpdate faz upsert em lote corretamente (insere novo, atualiza existente)', async () => {
    // Estado inicial: um slot já existente que vai ser atualizado
    await db.insert(schema.gradeHorarios).values({
      diaSemana: diaTeste,
      horaInicio: '09:00',
      horaFim: '09:30',
      ativo: false,
    })

    // Upsert em lote: atualiza o slot existente (09:00, ativo=false→true) e
    // insere um novo (10:00) — mesma chamada usada por atualizarGradeHorarios.
    await db
      .insert(schema.gradeHorarios)
      .values([
        { diaSemana: diaTeste, horaInicio: '09:00', horaFim: '09:45', ativo: true },
        { diaSemana: diaTeste, horaInicio: '10:00', horaFim: '10:30', ativo: true },
      ])
      .onConflictDoUpdate({
        target: [schema.gradeHorarios.diaSemana, schema.gradeHorarios.horaInicio],
        set: { horaFim: schema.gradeHorarios.horaFim, ativo: true },
      })

    const linhas = await db
      .select()
      .from(schema.gradeHorarios)
      .where(eq(schema.gradeHorarios.diaSemana, diaTeste))
      .orderBy(schema.gradeHorarios.horaInicio)

    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({ horaInicio: '09:00:00', ativo: true })
    expect(linhas[1]).toMatchObject({ horaInicio: '10:00:00', horaFim: '10:30:00', ativo: true })
  })

  it('codigoPg() extrai 23505 (unique_violation) de um insert duplicado real', async () => {
    await db.insert(schema.gradeHorarios).values({
      diaSemana: diaTeste,
      horaInicio: '14:00',
      horaFim: '14:30',
      ativo: true,
    })

    let erroCapturado: unknown
    try {
      // Mesma combinação (dia_semana, hora_inicio) já existe — sem onConflictDoUpdate,
      // deve violar a constraint única, igual bloquearData faz com datas_bloqueadas.
      await db.insert(schema.gradeHorarios).values({
        diaSemana: diaTeste,
        horaInicio: '14:00',
        horaFim: '15:00',
        ativo: true,
      })
    } catch (erro) {
      erroCapturado = erro
    }

    expect(erroCapturado).toBeDefined()
    expect(codigoPg(erroCapturado)).toBe('23505')
  })
})
