// salvarCliente contra Postgres real: o formulário público não pode trocar o
// e-mail de um cadastro que já existe (o histórico é buscado pelo e-mail).
//
// Requer DATABASE_URL apontando para um Postgres já migrado (`npm run db:migrate`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, like } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { salvarCliente } from '@/lib/db/clientes'

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
    await db.delete(schema.clientes).where(like(schema.clientes.telefone, `${marcador}%`))
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
})
