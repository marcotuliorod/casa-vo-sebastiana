import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks globais ─────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    query: {
      agendamentos: { findFirst: vi.fn() },
    },
  },
}))
vi.mock('@/lib/queries/availability', () => ({ getSlotsDisponiveis: vi.fn() }))
vi.mock('@/lib/queries/eventos', () => ({
  getEvento: vi.fn(),
  contarInscritosOcorrencia: vi.fn(),
}))
// Só o envio é falso; listaDeEmails e afins são os reais
vi.mock('@/lib/email/cliente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/cliente')>()),
  enviarEmail: vi.fn(),
}))
vi.mock('@/lib/email/templates', () => {
  const mk = (nome: string) =>
    vi.fn(() => ({ assunto: `assunto-${nome}`, texto: `texto-${nome}`, html: `html-${nome}` }))
  return {
    emailConfirmacao: mk('confirmacao'),
    emailCancelamento: mk('cancelamento'),
    emailNovoAgendamentoAdmin: mk('novo-admin'),
    emailCancelamentoAdmin: mk('cancelamento-admin'),
    emailConfirmacaoEvento: mk('confirmacao-evento'),
  }
})

import { db } from '@/lib/db'
import { enviarEmail } from '@/lib/email/cliente'
import { emailNovoAgendamentoAdmin, emailCancelamentoAdmin } from '@/lib/email/templates'
import { clientes, emailQueue, logsEmail } from '@/lib/db/schema'
import { getSlotsDisponiveis } from '@/lib/queries/availability'
import { getEvento, contarInscritosOcorrencia } from '@/lib/queries/eventos'
import type { Evento } from '@/types/database'
import { cancelarAgendamento, criarAgendamento, inscreverEmEvento } from '@/lib/actions/booking'
import { MENSAGEM_LIMITE, zerarLimites } from '@/lib/rate-limit'

type MockDb = {
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  query: { agendamentos: { findFirst: ReturnType<typeof vi.fn> } }
}
const mockDb = db as unknown as MockDb
const mockEnviarEmail = vi.mocked(enviarEmail)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_CONSULENTE = 'maria@exemplo.com'
const ADMINS = ['casa@exemplo.com', 'mae@exemplo.com']

/** db.update(t).set(v).where(cond) */
function mkUpdateChain(erro?: Error) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => (erro ? Promise.reject(erro) : Promise.resolve([]))),
    })),
  }
}

/** Captura os valores passados a db.insert(tabela).values(v), por tabela */
function capturarInserts() {
  const inseridos = new Map<unknown, unknown[]>()
  mockDb.insert.mockImplementation((tabela: unknown) => ({
    values: vi.fn((v: unknown) => {
      inseridos.set(tabela, [...(inseridos.get(tabela) ?? []), v])
      // Retorno usado por clientes/agendamentos: .returning() e .onConflictDoUpdate().returning()
      const linha = [{ id: tabela === clientes ? 'cli-1' : 'ag-1', tokenPublico: 'tok-abc' }]
      return Object.assign(Promise.resolve([]), {
        returning: vi.fn(() => Promise.resolve(linha)),
        onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(linha)) })),
      })
    }),
  }))
  return inseridos
}

type Falha = 'lanca' | 'sucesso_false'

/** enviarEmail falso: dá certo, a não ser para quem estiver em `falhas` */
function mkEnvio(falhas: { consulente?: Falha; admin?: Falha } = {}) {
  mockEnviarEmail.mockImplementation(async (para: string[]) => {
    const quem = para.includes(ADMINS[0]) ? 'admin' : 'consulente'
    const falha = falhas[quem]
    if (falha === 'lanca') throw new Error(`timeout ${quem}`)
    if (falha === 'sucesso_false') return { sucesso: false, erro: `recusado ${quem}` }
    return { sucesso: true, idMensagem: `id-${quem}` }
  })
}

/** E-mail não configurado: enviarEmail lança para todos */
function emailIndisponivel() {
  mockEnviarEmail.mockRejectedValue(new Error('E-mail: configure RESEND_API_KEY e EMAIL_FROM no .env'))
}

function enviosPara(quem: 'admin' | 'consulente') {
  return mockEnviarEmail.mock.calls.filter(([para]) => para.includes(ADMINS[0]) === (quem === 'admin'))
}

function itemFila(nome: string, extra: { agendamentoId: string | null; destinatarios: string; tipo: string }) {
  return { ...extra, assunto: `assunto-${nome}`, texto: `texto-${nome}`, html: `html-${nome}` }
}

const agendamentoAtivo = {
  id: 'ag-1',
  status: 'confirmado',
  dataAgendada: '2025-04-01',
  horaInicio: '09:00:00',
  horaFim: '10:00:00',
  tokenPublico: 'tok-abc',
  cliente: { nome: 'Maria', telefone: '+5511999999999', email: EMAIL_CONSULENTE },
}

function formAgendamento(campos: Record<string, string> = {}) {
  const fd = new FormData()
  const padrao = {
    data: '2025-04-01',
    hora_inicio: '09:00',
    hora_fim: '10:00',
    nome: 'Maria Silva',
    telefone: '11999999999',
    email: EMAIL_CONSULENTE,
  }
  Object.entries({ ...padrao, ...campos }).forEach(([k, v]) => fd.set(k, v))
  return fd
}

const EVENTO_ID = '11111111-1111-4111-8111-111111111111'
const evento: Evento = {
  id: EVENTO_ID,
  titulo: 'Gira de Pretos Velhos',
  descricao: null,
  data_inicio: '2025-04-05',
  hora_inicio: '19:00:00',
  hora_fim: '21:00:00',
  capacidade: 50,
  recorrencia: 'nenhuma',
  data_fim_recorrencia: null,
  lembrete_horas: 24,
  ativo: true,
  criado_em: '2025-01-01T00:00:00Z',
  atualizado_em: '2025-01-01T00:00:00Z',
}

function formInscricao(campos: Record<string, string> = {}) {
  const fd = new FormData()
  const padrao = {
    evento_id: EVENTO_ID,
    data: '2025-04-05',
    nome: 'Maria Silva',
    telefone: '11999999999',
    email: EMAIL_CONSULENTE,
  }
  Object.entries({ ...padrao, ...campos }).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  zerarLimites()
  delete process.env.ADMIN_EMAIL_NOTIFICACOES
  delete process.env.MAX_AGENDAMENTOS_MES
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mockDb.update.mockReturnValue(mkUpdateChain())
  mockDb.query.agendamentos.findFirst.mockResolvedValue(agendamentoAtivo)
  // ehOcorrenciaValida (real) só aceita datas de hoje em diante: fixa "hoje" em 01/04/2025.
  // Só o Date é falsificado para não travar as promises.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2025-04-01T08:00:00-03:00'))
  vi.mocked(getSlotsDisponiveis).mockResolvedValue({
    slots: [{ hora_inicio: '09:00', hora_fim: '10:00' }],
  } as unknown as Awaited<ReturnType<typeof getSlotsDisponiveis>>)
  vi.mocked(getEvento).mockResolvedValue(evento)
  vi.mocked(contarInscritosOcorrencia).mockResolvedValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(console.error).mockRestore()
  vi.mocked(console.warn).mockRestore()
})

// ─────────────────────────────────────────────────────────────────────────────
// cancelarAgendamento (consulente, pelo token público)
// ─────────────────────────────────────────────────────────────────────────────
describe('cancelarAgendamento — e-mail', () => {
  const itemFilaEsperado = itemFila('cancelamento', {
    agendamentoId: 'ag-1',
    destinatarios: EMAIL_CONSULENTE,
    tipo: 'cancelamento',
  })

  it('enfileira quando o e-mail não está configurado', async () => {
    const inseridos = capturarInserts()
    emailIndisponivel()

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(inseridos.get(emailQueue)).toEqual([itemFilaEsperado])
    expect(inseridos.has(logsEmail)).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it('grava log "falhou" e enfileira quando o Resend recusa', async () => {
    const inseridos = capturarInserts()
    mkEnvio({ consulente: 'sucesso_false' })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(inseridos.get(logsEmail)).toEqual([
      expect.objectContaining({
        agendamentoId: 'ag-1',
        evento: 'cancelamento',
        paraEmail: EMAIL_CONSULENTE,
        assunto: 'assunto-cancelamento',
        status: 'falhou',
        mensagemErro: 'recusado consulente',
      }),
    ])
    expect(inseridos.get(emailQueue)).toEqual([itemFilaEsperado])
  })

  it('grava log "enviado" e não enfileira quando o envio dá certo', async () => {
    const inseridos = capturarInserts()
    mkEnvio()

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(mockEnviarEmail).toHaveBeenCalledWith(
      [EMAIL_CONSULENTE],
      expect.objectContaining({ assunto: 'assunto-cancelamento' })
    )
    expect(inseridos.get(logsEmail)).toEqual([
      expect.objectContaining({ status: 'enviado', idMensagemProvedor: 'id-consulente' }),
    ])
    expect(inseridos.has(emailQueue)).toBe(false)
  })

  it('consulente sem e-mail (cadastro antigo): cancela sem enviar nem enfileirar', async () => {
    const inseridos = capturarInserts()
    mkEnvio()
    mockDb.query.agendamentos.findFirst.mockResolvedValue({
      ...agendamentoAtivo,
      cliente: { ...agendamentoAtivo.cliente, email: null },
    })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(mockEnviarEmail).not.toHaveBeenCalled()
    expect(inseridos.has(emailQueue)).toBe(false)
  })

  it('não cancela de novo nem envia e-mail se já estava cancelado', async () => {
    mockDb.query.agendamentos.findFirst.mockResolvedValue({ ...agendamentoAtivo, status: 'cancelado' })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({ erro: 'Este agendamento já foi cancelado.' })
    expect(mockEnviarEmail).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// criarAgendamento — e-mail obrigatório e confirmação
// ─────────────────────────────────────────────────────────────────────────────
describe('criarAgendamento — e-mail', () => {
  it('exige e-mail', async () => {
    const resultado = await criarAgendamento(null, formAgendamento({ email: '' }))

    expect(resultado).toEqual({ erro: 'Informe seu e-mail', campo: 'email' })
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('rejeita e-mail inválido', async () => {
    const resultado = await criarAgendamento(null, formAgendamento({ email: 'maria@' }))

    expect(resultado).toEqual({ erro: 'E-mail inválido', campo: 'email' })
  })

  it('normaliza o e-mail (espaços e maiúsculas) ao salvar e ao enviar', async () => {
    const inseridos = capturarInserts()
    mkEnvio()

    await criarAgendamento(null, formAgendamento({ email: '  Maria@Exemplo.COM ' }))

    expect(inseridos.get(clientes)).toEqual([expect.objectContaining({ email: EMAIL_CONSULENTE })])
    expect(mockEnviarEmail).toHaveBeenCalledWith([EMAIL_CONSULENTE], expect.anything())
  })

  it('enfileira a confirmação quando o e-mail não está configurado', async () => {
    const inseridos = capturarInserts()
    emailIndisponivel()

    await criarAgendamento(null, formAgendamento())

    expect(inseridos.get(emailQueue)).toEqual([
      itemFila('confirmacao', { agendamentoId: 'ag-1', destinatarios: EMAIL_CONSULENTE, tipo: 'confirmacao' }),
    ])
  })

  it('grava log "falhou" e enfileira quando o Resend recusa', async () => {
    const inseridos = capturarInserts()
    mkEnvio({ consulente: 'sucesso_false' })

    await criarAgendamento(null, formAgendamento())

    expect(inseridos.get(logsEmail)).toEqual([
      expect.objectContaining({ evento: 'confirmacao_agendamento', status: 'falhou' }),
    ])
    expect(inseridos.get(emailQueue)).toEqual([
      expect.objectContaining({ agendamentoId: 'ag-1', tipo: 'confirmacao' }),
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// inscreverEmEvento — validação da data e confirmação por e-mail
// ─────────────────────────────────────────────────────────────────────────────
describe('inscreverEmEvento', () => {
  describe('validação da data da ocorrência', () => {
    it('rejeita data que não é ocorrência do evento (evento único em outro dia)', async () => {
      const resultado = await inscreverEmEvento(null, formInscricao({ data: '2025-04-06' }))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(contarInscritosOcorrencia).not.toHaveBeenCalled()
      expect(mockDb.insert).not.toHaveBeenCalled()
      expect(mockEnviarEmail).not.toHaveBeenCalled()
    })

    it('rejeita data que não bate com a recorrência semanal', async () => {
      vi.mocked(getEvento).mockResolvedValue({ ...evento, recorrencia: 'semanal' })

      // 05/04 é a primeira ocorrência; 09/04 fica no meio da semana
      const resultado = await inscreverEmEvento(null, formInscricao({ data: '2025-04-09' }))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('rejeita ocorrência que já passou', async () => {
      vi.mocked(getEvento).mockResolvedValue({ ...evento, data_inicio: '2025-03-29', recorrencia: 'semanal' })

      // 29/03 é ocorrência semanal, mas é anterior a "hoje" (01/04)
      const resultado = await inscreverEmEvento(null, formInscricao({ data: '2025-03-29' }))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('rejeita data após o fim da recorrência', async () => {
      vi.mocked(getEvento).mockResolvedValue({
        ...evento,
        recorrencia: 'semanal',
        data_fim_recorrencia: '2025-04-12',
      })

      const resultado = await inscreverEmEvento(null, formInscricao({ data: '2025-04-19' }))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('aceita ocorrência semanal futura e segue para a inscrição', async () => {
      capturarInserts()
      mkEnvio()
      vi.mocked(getEvento).mockResolvedValue({ ...evento, recorrencia: 'semanal' })

      const resultado = await inscreverEmEvento(null, formInscricao({ data: '2025-04-12' }))

      expect(resultado).toBeUndefined() // sucesso redireciona (redirect mockado)
      expect(contarInscritosOcorrencia).toHaveBeenCalledWith(EVENTO_ID, '2025-04-12')
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('confirmação por e-mail', () => {
    it('exige e-mail', async () => {
      const resultado = await inscreverEmEvento(null, formInscricao({ email: '' }))

      expect(resultado).toEqual({ erro: 'Informe seu e-mail', campo: 'email' })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('enfileira a confirmação quando o e-mail não está configurado', async () => {
      const inseridos = capturarInserts()
      emailIndisponivel()

      await inscreverEmEvento(null, formInscricao())

      expect(inseridos.get(emailQueue)).toEqual([
        itemFila('confirmacao-evento', {
          agendamentoId: 'ag-1',
          destinatarios: EMAIL_CONSULENTE,
          tipo: 'confirmacao',
        }),
      ])
    })

    it('grava log "falhou" e enfileira quando o Resend recusa', async () => {
      const inseridos = capturarInserts()
      mkEnvio({ consulente: 'sucesso_false' })

      await inscreverEmEvento(null, formInscricao())

      expect(inseridos.get(logsEmail)).toEqual([
        expect.objectContaining({ agendamentoId: 'ag-1', evento: 'confirmacao_agendamento', status: 'falhou' }),
      ])
      expect(inseridos.get(emailQueue)).toEqual([
        expect.objectContaining({ agendamentoId: 'ag-1', assunto: 'assunto-confirmacao-evento', tipo: 'confirmacao' }),
      ])
    })

    it('grava log "enviado" e não enfileira quando o envio dá certo', async () => {
      const inseridos = capturarInserts()
      mkEnvio()

      await inscreverEmEvento(null, formInscricao())

      expect(inseridos.get(logsEmail)).toEqual([
        expect.objectContaining({ status: 'enviado', idMensagemProvedor: 'id-consulente' }),
      ])
      expect(inseridos.has(emailQueue)).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Avisos à Casa (ADMIN_EMAIL_NOTIFICACOES)
// Falha vira item da fila (tipo 'admin'), sem log em logs_email (histórico do consulente).
// ─────────────────────────────────────────────────────────────────────────────
describe('avisos à Casa por e-mail', () => {
  const casos = [
    {
      nome: 'criarAgendamento (novo agendamento)',
      executar: () => criarAgendamento(null, formAgendamento()),
      template: emailNovoAgendamentoAdmin,
      assunto: 'novo-admin',
      agendamentoIdFila: 'ag-1' as string | null,
      dados: {
        nomeCliente: 'Maria Silva',
        telefoneCliente: '+5511999999999',
        emailCliente: EMAIL_CONSULENTE,
        dataAgendada: '2025-04-01',
        horaInicio: '09:00',
        horaFim: '10:00',
      },
    },
    {
      nome: 'inscreverEmEvento (nova inscrição)',
      executar: () => inscreverEmEvento(null, formInscricao()),
      template: emailNovoAgendamentoAdmin,
      assunto: 'novo-admin',
      agendamentoIdFila: 'ag-1' as string | null,
      dados: {
        nomeCliente: 'Maria Silva',
        telefoneCliente: '+5511999999999',
        emailCliente: EMAIL_CONSULENTE,
        dataAgendada: '2025-04-05',
        horaInicio: '19:00', // hora do evento sem segundos
        horaFim: '21:00',
        tituloEvento: 'Gira de Pretos Velhos',
      },
    },
    {
      nome: 'cancelarAgendamento (cancelamento pelo consulente)',
      executar: () => cancelarAgendamento('tok-abc'),
      template: emailCancelamentoAdmin,
      assunto: 'cancelamento-admin',
      // Sem vínculo: o cron descartaria item de agendamento cancelado
      agendamentoIdFila: null as string | null,
      dados: {
        nomeCliente: 'Maria',
        telefoneCliente: '+5511999999999',
        emailCliente: EMAIL_CONSULENTE,
        dataAgendada: '2025-04-01',
        horaInicio: '09:00',
        horaFim: '10:00',
      },
    },
  ]

  describe.each(casos)('$nome', ({ executar, template, assunto, dados, agendamentoIdFila }) => {
    const itemFilaAdmin = () =>
      itemFila(assunto, { agendamentoId: agendamentoIdFila, destinatarios: ADMINS.join(', '), tipo: 'admin' })

    beforeEach(() => {
      process.env.ADMIN_EMAIL_NOTIFICACOES = ` ${ADMINS[0]} , ${ADMINS[1]} `
    })

    it('envia para todos os e-mails de ADMIN_EMAIL_NOTIFICACOES, sem log nem fila', async () => {
      const inseridos = capturarInserts()
      mkEnvio()

      await executar()

      expect(template).toHaveBeenCalledWith(dados)
      expect(enviosPara('admin')).toEqual([[ADMINS, expect.objectContaining({ assunto: `assunto-${assunto}` })]])
      expect(inseridos.has(emailQueue)).toBe(false)
      // Só o consulente entra no histórico
      expect(inseridos.get(logsEmail)).toEqual([expect.objectContaining({ paraEmail: EMAIL_CONSULENTE })])
    })

    it('não avisa a Casa quando ADMIN_EMAIL_NOTIFICACOES está vazio', async () => {
      delete process.env.ADMIN_EMAIL_NOTIFICACOES
      capturarInserts()
      mkEnvio()

      await executar()

      expect(enviosPara('admin')).toEqual([])
      // O consulente continua recebendo
      expect(enviosPara('consulente')).toHaveLength(1)
    })

    it('enfileira (sem log) quando o envio à Casa lança, sem afetar o consulente', async () => {
      const inseridos = capturarInserts()
      mkEnvio({ admin: 'lanca' })

      const resultado = await executar()

      // Ações com redirect (mockado) retornam undefined; o cancelamento retorna {}
      expect(resultado === undefined || JSON.stringify(resultado) === '{}').toBe(true)
      expect(inseridos.get(emailQueue)).toEqual([itemFilaAdmin()])
      expect(inseridos.get(logsEmail)).toEqual([
        expect.objectContaining({ paraEmail: EMAIL_CONSULENTE, status: 'enviado' }),
      ])
    })

    it('enfileira (sem log) quando o Resend recusa o envio à Casa', async () => {
      const inseridos = capturarInserts()
      mkEnvio({ admin: 'sucesso_false' })

      await executar()

      expect(inseridos.get(emailQueue)).toEqual([itemFilaAdmin()])
    })

    it('enfileira consulente e Casa quando o e-mail não está configurado', async () => {
      const inseridos = capturarInserts()
      emailIndisponivel()

      await executar()

      const fila = inseridos.get(emailQueue) as Array<{ tipo: string }>
      expect(fila.map((i) => i.tipo)).toEqual([expect.not.stringMatching(/^admin$/), 'admin'])
      expect(fila[1]).toEqual(itemFilaAdmin())
      expect(inseridos.has(logsEmail)).toBe(false)
    })
  })
})

describe('limite de tentativas', () => {
  it('criarAgendamento recusa a 11ª tentativa na mesma hora', async () => {
    vi.mocked(getSlotsDisponiveis).mockResolvedValue({ slots: [] } as never)
    for (let i = 0; i < 10; i++) {
      const r = await criarAgendamento(null, formAgendamento())
      expect(r?.erro).not.toBe(MENSAGEM_LIMITE)
    }
    expect(await criarAgendamento(null, formAgendamento())).toEqual({ erro: MENSAGEM_LIMITE })
    // A tentativa barrada não chega ao banco nem à disponibilidade
    expect(getSlotsDisponiveis).toHaveBeenCalledTimes(10)
  })

  it('inscreverEmEvento recusa a 11ª tentativa na mesma hora', async () => {
    vi.mocked(getEvento).mockResolvedValue(null)
    for (let i = 0; i < 10; i++) {
      const r = await inscreverEmEvento(null, formInscricao())
      expect(r?.erro).not.toBe(MENSAGEM_LIMITE)
    }
    expect(await inscreverEmEvento(null, formInscricao())).toEqual({ erro: MENSAGEM_LIMITE })
    expect(getEvento).toHaveBeenCalledTimes(10)
  })
})
