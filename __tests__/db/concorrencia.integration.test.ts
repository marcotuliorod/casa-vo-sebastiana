// Corridas contra Postgres real: pedidos simultâneos não podem passar da
// capacidade de um evento nem deixar dois médiuns com o mesmo atendimento.
// Os testes com banco falso não pegam isso, porque a proteção está no SQL
// (trava pg_advisory_xact_lock e UPDATE condicional).
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-real-ip': '203.0.113.7' })),
}))
// Nada de e-mail de verdade (nem itens na fila) durante o teste
vi.mock('@/lib/email/envio', () => ({ enviarEmailComFila: vi.fn(async () => {}) }))

import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { inscreverEmEvento } from '@/lib/actions/booking'
import { assumirAgendamento } from '@/lib/actions/mediuns'
import { hojeBr } from '@/lib/utils/date'
import { zerarLimites } from '@/lib/rate-limit'

const DATABASE_URL = process.env.DATABASE_URL

// Telefones válidos e únicos para este teste (DDD 11, celular)
const base = String(Date.now()).slice(-7)
const telefones = Array.from({ length: 6 }, (_, i) => `119${i}${base}`)

function daquiA(dias: number): string {
  const d = new Date(`${hojeBr()}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

describe.skipIf(!DATABASE_URL)('concorrência — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  let eventoId: string
  const mediunsIds: string[] = []
  const agendamentosAvulsos: string[] = []

  beforeAll(async () => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })
    zerarLimites()
  })

  afterAll(async () => {
    if (eventoId) {
      await db.delete(schema.agendamentos).where(eq(schema.agendamentos.eventoId, eventoId))
      await db.delete(schema.eventos).where(eq(schema.eventos.id, eventoId))
    }
    if (agendamentosAvulsos.length) {
      await db.delete(schema.agendamentos).where(inArray(schema.agendamentos.id, agendamentosAvulsos))
    }
    if (mediunsIds.length) {
      await db.delete(schema.mediuns).where(inArray(schema.mediuns.id, mediunsIds))
    }
    await db
      .delete(schema.clientes)
      .where(inArray(schema.clientes.telefone, telefones.map((t) => `+55${t}`)))
    await client.end()
  })

  it('inscrições simultâneas não passam da capacidade do evento', async () => {
    const data = daquiA(7)
    const [evento] = await db
      .insert(schema.eventos)
      .values({
        titulo: 'Evento de teste de concorrência',
        dataInicio: data,
        horaInicio: '19:00',
        horaFim: '21:00',
        capacidade: 2,
        recorrencia: 'nenhuma',
        ativo: true,
      })
      .returning()
    eventoId = evento.id

    const resultados = await Promise.all(
      telefones.slice(0, 5).map((telefone, i) => {
        const fd = new FormData()
        fd.set('evento_id', evento.id)
        fd.set('data', data)
        fd.set('nome', `Pessoa Teste ${i}`)
        fd.set('telefone', telefone)
        fd.set('email', `pessoa${i}@exemplo.com`)
        fd.set('consentimento', 'sim')
        return inscreverEmEvento(null, fd)
      })
    )

    const inscritos = await db
      .select({ id: schema.agendamentos.id })
      .from(schema.agendamentos)
      .where(eq(schema.agendamentos.eventoId, evento.id))

    expect(inscritos).toHaveLength(2)
    expect(resultados.filter((r) => r === undefined)).toHaveLength(2) // sucesso redireciona
    expect(resultados.filter((r) => r?.erro === 'Não há mais vagas disponíveis para esta data.')).toHaveLength(3)
  })

  it('dois médiuns assumindo ao mesmo tempo: só um fica com o atendimento', async () => {
    const meds = await db
      .insert(schema.mediuns)
      .values([
        { nome: 'Médium Teste A', ativo: true },
        { nome: 'Médium Teste B', ativo: true },
      ])
      .returning()
    mediunsIds.push(...meds.map((m) => m.id))

    const [cli] = await db
      .insert(schema.clientes)
      .values({ nome: 'Consulente Teste', telefone: `+55${telefones[5]}`, email: 'c@exemplo.com' })
      .returning()
    const [ag] = await db
      .insert(schema.agendamentos)
      .values({
        clienteId: cli.id,
        dataAgendada: daquiA(8),
        horaInicio: '06:00',
        horaFim: '06:30',
        status: 'pendente',
      })
      .returning()
    agendamentosAvulsos.push(ag.id)

    const resultados = await Promise.all(meds.map((m) => assumirAgendamento(ag.id, m.tokenAcesso)))

    expect(resultados.filter((r) => !r.erro)).toHaveLength(1)
    expect(resultados.filter((r) => r.erro === 'Este agendamento já foi assumido por outro médium.')).toHaveLength(1)

    const [final] = await db.select().from(schema.agendamentos).where(eq(schema.agendamentos.id, ag.id))
    const vencedor = meds[resultados.findIndex((r) => !r.erro)]
    expect(final.mediumId).toBe(vencedor.id)
  })
})
