// Teste de integração contra Postgres real — cobre o que os testes unitários
// (que mockam o client de dados) nunca exercitam: a constraint EXCLUDE USING
// GIST, os triggers de atualizado_em e os enums do Postgres.
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).
// Sem DATABASE_URL, a suíte inteira é pulada — não bloqueia `npm test` local
// sem Docker. No CI, o serviço postgres do ci.yml supre isso.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, inArray, like, sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('schema Drizzle — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  const marcador = `TESTE_INTEGRACAO_${Date.now()}_`
  // Data isolada por execução — evita colisão com a exclusion constraint caso
  // uma execução anterior tenha falhado antes de limpar (ela é global por dia+horário).
  const dataGistTeste = new Date(Date.now() + 1000 * 60 * 60 * 24 * (365 + (Date.now() % 1000)))
    .toISOString()
    .slice(0, 10)

  beforeAll(() => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })
  })

  afterAll(async () => {
    // Limpeza em ordem reversa de dependência
    const clientesTeste = await db
      .select({ id: schema.clientes.id })
      .from(schema.clientes)
      .where(like(schema.clientes.telefone, `${marcador}%`))
    const ids = clientesTeste.map((c) => c.id)
    if (ids.length) {
      await db.delete(schema.agendamentos).where(inArray(schema.agendamentos.clienteId, ids))
      await db.delete(schema.clientes).where(inArray(schema.clientes.id, ids))
    }
    await db.delete(schema.eventos).where(like(schema.eventos.titulo, `${marcador}%`))
    await client.end()
  })

  it('o trigger set_atualizado_em() atualiza atualizado_em em UPDATE', async () => {
    const [cliente] = await db
      .insert(schema.clientes)
      .values({ nome: 'Cliente Teste', telefone: `${marcador}trigger` })
      .returning()

    await new Promise((r) => setTimeout(r, 1100))

    const [atualizado] = await db
      .update(schema.clientes)
      .set({ nome: 'Cliente Teste 2' })
      .where(eq(schema.clientes.id, cliente.id))
      .returning()

    expect(atualizado.atualizadoEm.getTime()).toBeGreaterThan(cliente.atualizadoEm.getTime())
  })

  it('a constraint EXCLUDE USING GIST rejeita dois agendamentos no mesmo horário', async () => {
    const [clienteA, clienteB] = await db
      .insert(schema.clientes)
      .values([
        { nome: 'Cliente A', telefone: `${marcador}gist_a` },
        { nome: 'Cliente B', telefone: `${marcador}gist_b` },
      ])
      .returning()

    await db.insert(schema.agendamentos).values({
      clienteId: clienteA.id,
      dataAgendada: dataGistTeste,
      horaInicio: '09:00',
      horaFim: '09:30',
      status: 'pendente',
    })

    // drizzle-orm envolve o erro do driver num DrizzleQueryError; o código do
    // Postgres (23P01 = exclusion_violation) fica em `.cause.code`, não no
    // erro de nível superior — importante para a Fase 2 (lib/actions/booking.ts
    // hoje faz `erroAgendamento.code === '23P01'` no client supabase-js, que
    // expõe o código diretamente).
    await expect(
      db.insert(schema.agendamentos).values({
        clienteId: clienteB.id,
        dataAgendada: dataGistTeste,
        horaInicio: '09:00',
        horaFim: '09:30',
        status: 'confirmado',
      })
    ).rejects.toMatchObject({ cause: { code: '23P01' } })
  })

  it('agendamentos de evento no mesmo horário NÃO disparam a exclusion constraint', async () => {
    const [clienteA, clienteB] = await db
      .insert(schema.clientes)
      .values([
        { nome: 'Cliente C', telefone: `${marcador}evento_a` },
        { nome: 'Cliente D', telefone: `${marcador}evento_b` },
      ])
      .returning()

    const [evento] = await db
      .insert(schema.eventos)
      .values({
        titulo: `${marcador}Gira Pública`,
        dataInicio: '2026-09-05',
        horaInicio: '19:00',
        horaFim: '21:00',
        capacidade: 50,
      })
      .returning()

    await db.insert(schema.agendamentos).values({
      clienteId: clienteA.id,
      eventoId: evento.id,
      dataAgendada: '2026-09-05',
      horaInicio: '19:00',
      horaFim: '21:00',
      status: 'pendente',
    })

    await expect(
      db.insert(schema.agendamentos).values({
        clienteId: clienteB.id,
        eventoId: evento.id,
        dataAgendada: '2026-09-05',
        horaInicio: '19:00',
        horaFim: '21:00',
        status: 'pendente',
      })
    ).resolves.not.toThrow()
  })

  it('o enum appointment_status rejeita valores fora da lista', async () => {
    const [cliente] = await db
      .insert(schema.clientes)
      .values({ nome: 'Cliente Enum', telefone: `${marcador}enum` })
      .returning()

    await expect(
      db.execute(sql`
        INSERT INTO agendamentos (cliente_id, data_agendada, hora_inicio, hora_fim, status)
        VALUES (${cliente.id}, '2026-09-10', '10:00', '10:30', 'status_invalido')
      `)
    ).rejects.toBeTruthy()
  })
})
