// Teste de integração contra Postgres real para as queries mais arriscadas
// da tradução supabase-js → Drizzle: a busca cross-table por ILIKE em
// listarAgendamentos (equivalente ao antigo `.or(..., {foreignTable})`) e a
// lógica de datas de listarEventosAtivos (evento recorrente com início no
// passado ainda deve aparecer se tiver ocorrências futuras). Nenhuma delas
// tinha teste antes (nem mockado) — ver plano de migração, Fase 2.
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { inArray, like } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import * as schema from '@/lib/db/schema'
import { listarAgendamentos } from '@/lib/queries/appointments'
import { listarEventosAtivos } from '@/lib/queries/eventos'
import { getMediumPorToken, getAgendamentosDoMedium } from '@/lib/queries/mediuns'

const DATABASE_URL = process.env.DATABASE_URL

// As queries comparam com a data de Brasília; usar UTC aqui quebra o teste entre 00:00 e 03:00 UTC.
const dataBR = (offsetDias: number) =>
  formatInTimeZone(new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000), 'America/Sao_Paulo', 'yyyy-MM-dd')

// As queries testadas usam a instância singleton de lib/db, então este teste
// também precisa dela apontar para o mesmo Postgres — garantido pelo mesmo
// DATABASE_URL usado tanto aqui quanto em lib/db/index.ts.

describe.skipIf(!DATABASE_URL)('queries — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  const marcador = `TESTE_QUERIES_${Date.now()}_`

  beforeAll(() => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })
  })

  afterAll(async () => {
    const clientesTeste = await db
      .select({ id: schema.clientes.id })
      .from(schema.clientes)
      .where(like(schema.clientes.telefone, `${marcador}%`))
    const idsClientes = clientesTeste.map((c) => c.id)
    if (idsClientes.length) {
      await db.delete(schema.agendamentos).where(inArray(schema.agendamentos.clienteId, idsClientes))
      await db.delete(schema.clientes).where(inArray(schema.clientes.id, idsClientes))
    }
    await db.delete(schema.eventos).where(like(schema.eventos.titulo, `${marcador}%`))
    await db.delete(schema.mediuns).where(like(schema.mediuns.nome, `${marcador}%`))
    await client.end()
  })

  it('listarAgendamentos com busca filtra por nome/telefone do cliente via join', async () => {
    const [clienteAna, clienteBeto] = await db
      .insert(schema.clientes)
      .values([
        { nome: `${marcador}Ana Silva`, telefone: `${marcador}ana` },
        { nome: `${marcador}Beto Souza`, telefone: `${marcador}beto` },
      ])
      .returning()

    const dataTeste = '2031-06-15'
    await db.insert(schema.agendamentos).values([
      {
        clienteId: clienteAna.id,
        dataAgendada: dataTeste,
        horaInicio: '09:00',
        horaFim: '09:30',
        status: 'pendente',
      },
      {
        clienteId: clienteBeto.id,
        dataAgendada: dataTeste,
        horaInicio: '10:00',
        horaFim: '10:30',
        status: 'pendente',
      },
    ])

    const resultado = await listarAgendamentos({ busca: `${marcador}Ana` })

    expect(resultado).toHaveLength(1)
    expect(resultado[0].clientes.nome).toBe(`${marcador}Ana Silva`)
  })

  it('listarAgendamentos com tipo=evento só retorna agendamentos vinculados a evento', async () => {
    const [cliente] = await db
      .insert(schema.clientes)
      .values({ nome: `${marcador}Cliente Evento`, telefone: `${marcador}evento_tipo` })
      .returning()

    const [evento] = await db
      .insert(schema.eventos)
      .values({
        titulo: `${marcador}Evento Tipo`,
        dataInicio: '2031-07-01',
        horaInicio: '19:00',
        horaFim: '20:00',
        capacidade: 10,
      })
      .returning()

    await db.insert(schema.agendamentos).values([
      {
        clienteId: cliente.id,
        eventoId: evento.id,
        dataAgendada: '2031-07-01',
        horaInicio: '19:00',
        horaFim: '20:00',
        status: 'pendente',
      },
      {
        clienteId: cliente.id,
        dataAgendada: '2031-07-02',
        horaInicio: '09:00',
        horaFim: '09:30',
        status: 'pendente',
      },
    ])

    const comEvento = await listarAgendamentos({ tipo: 'evento', busca: `${marcador}Cliente Evento` })
    const semEvento = await listarAgendamentos({ tipo: 'horario', busca: `${marcador}Cliente Evento` })

    expect(comEvento).toHaveLength(1)
    expect(comEvento[0].evento_id).toBe(evento.id)
    expect(semEvento).toHaveLength(1)
    expect(semEvento[0].evento_id).toBeNull()
  })

  it('listarEventosAtivos inclui evento recorrente com início no passado mas ocorrências futuras', async () => {
    // Início há 30 dias, recorrência semanal sem data de fim — tem ocorrências futuras
    const inicioPassado = dataBR(-30)

    await db.insert(schema.eventos).values({
      titulo: `${marcador}Gira Semanal`,
      dataInicio: inicioPassado,
      horaInicio: '19:00',
      horaFim: '21:00',
      capacidade: 20,
      recorrencia: 'semanal',
      ativo: true,
    })

    const ativos = await listarEventosAtivos()
    expect(ativos.some((e) => e.titulo === `${marcador}Gira Semanal`)).toBe(true)
  })

  it('listarEventosAtivos NÃO inclui evento único cuja data já passou', async () => {
    const ontem = dataBR(-1)

    await db.insert(schema.eventos).values({
      titulo: `${marcador}Evento Passado`,
      dataInicio: ontem,
      horaInicio: '19:00',
      horaFim: '21:00',
      capacidade: 20,
      recorrencia: 'nenhuma',
      ativo: true,
    })

    const ativos = await listarEventosAtivos()
    expect(ativos.some((e) => e.titulo === `${marcador}Evento Passado`)).toBe(false)
  })

  it('getMediumPorToken + getAgendamentosDoMedium fazem o join com cliente corretamente', async () => {
    const [medium] = await db
      .insert(schema.mediuns)
      .values({ nome: `${marcador}Médium Teste`, tokenAcesso: `${marcador}token123` })
      .returning()

    const [cliente] = await db
      .insert(schema.clientes)
      .values({ nome: `${marcador}Cliente Medium`, telefone: `${marcador}medium_cli` })
      .returning()

    const dataFutura = dataBR(10)
    await db.insert(schema.agendamentos).values({
      clienteId: cliente.id,
      mediumId: medium.id,
      dataAgendada: dataFutura,
      horaInicio: '15:00',
      horaFim: '15:30',
      status: 'confirmado',
    })

    const encontrado = await getMediumPorToken(`${marcador}token123`)
    expect(encontrado?.nome).toBe(`${marcador}Médium Teste`)

    const agendamentosDoMedium = await getAgendamentosDoMedium(medium.id)
    expect(agendamentosDoMedium).toHaveLength(1)
    expect(agendamentosDoMedium[0].clientes.nome).toBe(`${marcador}Cliente Medium`)
  })
})
