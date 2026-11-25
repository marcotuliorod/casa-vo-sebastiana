// salvarCliente contra Postgres real: o formulário público não pode trocar o
// e-mail de um cadastro que já existe (o histórico é buscado pelo e-mail).
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, like } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import {
  apagarClienteComHistorico,
  corteRetencaoCadastro,
  idsCadastrosVencidos,
  salvarCliente,
  telefoneDeOutroCadastro,
} from '@/lib/db/clientes'
import { VERSAO_TEXTOS_LGPD } from '@/lib/consentimento'

const DATABASE_URL = process.env.DATABASE_URL

describe.skipIf(!DATABASE_URL)('salvarCliente — integração com Postgres real', () => {
  let client: postgres.Sql
  let db: PostgresJsDatabase<typeof schema>
  const marcador = `TESTE_CLI_${Date.now()}_`

  beforeAll(() => {
    client = postgres(DATABASE_URL!)
    db = drizzle(client, { schema })
  })

  afterAll(async () => {
    const ids = (
      await db.select({ id: schema.clientes.id }).from(schema.clientes).where(like(schema.clientes.telefone, `${marcador}%`))
    ).map((c) => c.id)
    for (const id of ids) await db.transaction((tx) => apagarClienteComHistorico(tx, id))
    await client.end()
  })

  async function lerCadastro(telefone: string) {
    const [linha] = await db.select().from(schema.clientes).where(eq(schema.clientes.telefone, telefone))
    return linha
  }

  it('cria o cadastro quando o telefone é novo', async () => {
    const telefone = `${marcador}1`
    const [cli] = await salvarCliente(db, { nome: 'Maria Silva', telefone, email: 'maria@exemplo.com' })

    expect(cli.nome).toBe('Maria Silva')
    expect(cli.email).toBe('maria@exemplo.com')
  })

  it('telefone já cadastrado com outro e-mail: mantém e-mail e nome do cadastro', async () => {
    const telefone = `${marcador}2`
    await salvarCliente(db, { nome: 'Maria Silva', telefone, email: 'maria@exemplo.com' })

    const [cli] = await salvarCliente(db, { nome: 'Outra Pessoa', telefone, email: 'outra@exemplo.com' })

    expect(cli.email).toBe('maria@exemplo.com')
    expect(cli.nome).toBe('Maria Silva')
    expect(await lerCadastro(telefone)).toMatchObject({ email: 'maria@exemplo.com', nome: 'Maria Silva' })
  })

  it('mesmo e-mail (sem diferenciar maiúsculas): atualiza o nome', async () => {
    const telefone = `${marcador}3`
    await salvarCliente(db, { nome: 'Maria', telefone, email: 'Maria@Exemplo.com' })

    const [cli] = await salvarCliente(db, { nome: 'Maria da Silva', telefone, email: 'maria@exemplo.com' })

    expect(cli.nome).toBe('Maria da Silva')
    expect(cli.email).toBe('Maria@Exemplo.com')
  })

  it('cadastro antigo sem e-mail: preenche com o e-mail informado', async () => {
    const telefone = `${marcador}4`
    await db.insert(schema.clientes).values({ nome: 'Cadastro antigo', telefone, email: null })

    const [cli] = await salvarCliente(db, { nome: 'Cadastro Novo', telefone, email: 'novo@exemplo.com' })

    expect(cli.email).toBe('novo@exemplo.com')
    expect(cli.nome).toBe('Cadastro Novo')
  })

  it('grava quando a pessoa autorizou o uso dos dados (consentimento)', async () => {
    const telefone = `${marcador}5`
    const antes = Date.now()
    const [cli] = await salvarCliente(db, { nome: 'Maria', telefone, email: 'maria5@exemplo.com' })

    expect(cli.consentimentoEm).toBeInstanceOf(Date)
    expect(cli.consentimentoEm!.getTime()).toBeGreaterThanOrEqual(antes - 5_000)
  })

  it('pedido com o telefone de outra pessoa não mexe no consentimento dela', async () => {
    const telefone = `${marcador}6`
    await db.insert(schema.clientes).values({ nome: 'Dona', telefone, email: 'dona@exemplo.com', consentimentoEm: new Date('2026-01-01T00:00:00Z') })

    const [cli] = await salvarCliente(db, { nome: 'Outra', telefone, email: 'outra6@exemplo.com' })

    expect(cli.consentimentoEm?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('grava a versão do texto aceito junto com a data', async () => {
    const [cli] = await salvarCliente(db, { nome: 'Maria', telefone: `${marcador}7`, email: 'maria7@exemplo.com' })
    expect(cli.consentimentoVersao).toBe(VERSAO_TEXTOS_LGPD)
  })

  it('telefoneDeOutroCadastro: só é conflito com outro e-mail (sem diferenciar maiúsculas)', async () => {
    const telefone = `${marcador}8`
    expect(await telefoneDeOutroCadastro(db, telefone, 'qualquer@exemplo.com')).toBe(false) // telefone novo
    await salvarCliente(db, { nome: 'Dona', telefone, email: 'Dona8@Exemplo.com' })
    expect(await telefoneDeOutroCadastro(db, telefone, 'dona8@exemplo.com')).toBe(false)
    expect(await telefoneDeOutroCadastro(db, telefone, 'outra8@exemplo.com')).toBe(true)
  })

  it('cadastro antigo sem e-mail não conta como conflito', async () => {
    const telefone = `${marcador}9`
    await db.insert(schema.clientes).values({ nome: 'Antigo', telefone, email: null })
    expect(await telefoneDeOutroCadastro(db, telefone, 'novo9@exemplo.com')).toBe(false)
  })

  it('cadastros vencidos: último atendimento antes do corte de 2 anos; recentes ficam', async () => {
    const agora = new Date('2030-06-15T12:00:00Z')
    expect(corteRetencaoCadastro(agora)).toBe('2028-06-15')
    const [velho, recente, semAgendamento] = await db
      .insert(schema.clientes)
      .values([
        { nome: 'Velho', telefone: `${marcador}10`, email: 'v@exemplo.com' },
        { nome: 'Recente', telefone: `${marcador}11`, email: 'r@exemplo.com' },
        { nome: 'Sem agendamento', telefone: `${marcador}12`, email: 's@exemplo.com', criadoEm: new Date('2028-01-01T12:00:00Z') },
      ])
      .returning()
    const [agVelho] = await db
      .insert(schema.agendamentos)
      .values([
        { clienteId: velho.id, dataAgendada: '2028-06-01', horaInicio: '09:00', horaFim: '09:30', status: 'realizado' },
        { clienteId: recente.id, dataAgendada: '2028-06-01', horaInicio: '10:00', horaFim: '10:30', status: 'realizado' },
        { clienteId: recente.id, dataAgendada: '2029-12-01', horaInicio: '10:00', horaFim: '10:30', status: 'realizado' },
      ])
      .returning()
    await db.insert(schema.emailQueue).values({
      agendamentoId: agVelho.id, destinatarios: 'v@exemplo.com', assunto: 'x', texto: 't', html: 'h', tipo: 'confirmacao', status: 'falhou',
    })

    const vencidos = await idsCadastrosVencidos(db, agora, 10_000)
    expect(vencidos).toContain(velho.id)
    expect(vencidos).toContain(semAgendamento.id)
    expect(vencidos).not.toContain(recente.id)

    await db.transaction((tx) => apagarClienteComHistorico(tx, velho.id))
    expect(await db.select().from(schema.clientes).where(eq(schema.clientes.id, velho.id))).toEqual([])
    expect(await db.select().from(schema.emailQueue).where(eq(schema.emailQueue.destinatarios, 'v@exemplo.com'))).toEqual([])
  })
})
