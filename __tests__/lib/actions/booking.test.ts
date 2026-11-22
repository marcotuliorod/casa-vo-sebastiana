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
vi.mock('@/lib/whatsapp/factory', () => ({
  getProvedorWhatsApp: vi.fn(),
}))
vi.mock('@/lib/whatsapp/templates', () => ({
  mensagemConfirmacao: vi.fn(() => 'msg-confirmacao'),
  mensagemCancelamento: vi.fn(() => 'msg-cancelamento'),
  mensagemNovoAgendamentoAdmin: vi.fn(() => 'msg-novo-admin'),
  mensagemCancelamentoAdmin: vi.fn(() => 'msg-cancelamento-admin'),
  mensagemConfirmacaoEvento: vi.fn(() => 'msg-confirmacao-evento'),
}))

import { db } from '@/lib/db'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { clientes, logsWhatsapp, whatsappQueue } from '@/lib/db/schema'
import { getSlotsDisponiveis } from '@/lib/queries/availability'
import { cancelarAgendamento, criarAgendamento } from '@/lib/actions/booking'

type MockDb = {
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  query: { agendamentos: { findFirst: ReturnType<typeof vi.fn> } }
}
const mockDb = db as unknown as MockDb
const mockGetProvedorWhatsApp = getProvedorWhatsApp as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const agendamentoAtivo = {
  id: 'ag-1',
  status: 'confirmado',
  dataAgendada: '2025-04-01',
  horaInicio: '09:00',
  horaFim: '10:00',
  tokenPublico: 'tok-abc',
  cliente: { nome: 'Maria', telefone: '+5511999999999' },
}

const itemFilaEsperado = {
  agendamentoId: 'ag-1',
  telefone: '+5511999999999',
  mensagem: 'msg-cancelamento',
  tipo: 'cancelamento',
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ADMIN_WHATSAPP
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockDb.update.mockReturnValue(mkUpdateChain())
  mockDb.query.agendamentos.findFirst.mockResolvedValue(agendamentoAtivo)
})

afterEach(() => {
  vi.mocked(console.error).mockRestore()
})

// ─────────────────────────────────────────────────────────────────────────────
// cancelarAgendamento (consulente, pelo token público)
// ─────────────────────────────────────────────────────────────────────────────
describe('cancelarAgendamento — WhatsApp', () => {
  it('enfileira quando getProvedorWhatsApp lança (credenciais ausentes)', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockImplementation(() => {
      throw new Error('Z-API: configure ZAPI_INSTANCE_ID')
    })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(inseridos.get(whatsappQueue)).toEqual([itemFilaEsperado])
    expect(console.error).toHaveBeenCalled()
  })

  it('enfileira quando enviarMensagem lança exceção', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockReturnValue({
      nome: 'zapi',
      enviarMensagem: vi.fn().mockRejectedValue(new Error('timeout')),
    })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(inseridos.get(whatsappQueue)).toEqual([itemFilaEsperado])
  })

  it('grava log "falhou" e enfileira quando o envio retorna sucesso:false', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockReturnValue({
      nome: 'zapi',
      enviarMensagem: vi.fn().mockResolvedValue({ sucesso: false, erro: 'número inválido' }),
    })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(inseridos.get(logsWhatsapp)).toEqual([
      expect.objectContaining({
        agendamentoId: 'ag-1',
        evento: 'cancelamento',
        provedor: 'zapi',
        status: 'falhou',
        mensagemErro: 'número inválido',
      }),
    ])
    expect(inseridos.get(whatsappQueue)).toEqual([itemFilaEsperado])
  })

  it('não cancela de novo nem envia WhatsApp se já estava cancelado', async () => {
    mockDb.query.agendamentos.findFirst.mockResolvedValue({ ...agendamentoAtivo, status: 'cancelado' })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({ erro: 'Este agendamento já foi cancelado.' })
    expect(mockGetProvedorWhatsApp).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('grava log "enviado" e não enfileira quando o envio dá certo', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockReturnValue({
      nome: 'zapi',
      enviarMensagem: vi.fn().mockResolvedValue({ sucesso: true, idMensagemProvedor: 'm-1' }),
    })

    const resultado = await cancelarAgendamento('tok-abc')

    expect(resultado).toEqual({})
    expect(inseridos.get(logsWhatsapp)).toEqual([
      expect.objectContaining({ status: 'enviado', idMensagemProvedor: 'm-1' }),
    ])
    expect(inseridos.has(whatsappQueue)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// criarAgendamento — confirmação via WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
describe('criarAgendamento — WhatsApp', () => {
  function formAgendamento() {
    const fd = new FormData()
    fd.set('data', '2025-04-01')
    fd.set('hora_inicio', '09:00')
    fd.set('hora_fim', '10:00')
    fd.set('nome', 'Maria Silva')
    fd.set('telefone', '11999999999')
    return fd
  }

  beforeEach(() => {
    delete process.env.MAX_AGENDAMENTOS_MES
    vi.mocked(getSlotsDisponiveis).mockResolvedValue({
      slots: [{ hora_inicio: '09:00', hora_fim: '10:00' }],
    } as unknown as Awaited<ReturnType<typeof getSlotsDisponiveis>>)
  })

  it('enfileira a confirmação quando getProvedorWhatsApp lança (credenciais ausentes)', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockImplementation(() => {
      throw new Error('Z-API: configure ZAPI_INSTANCE_ID')
    })

    await criarAgendamento(null, formAgendamento())

    expect(inseridos.get(whatsappQueue)).toEqual([
      {
        agendamentoId: 'ag-1',
        telefone: '+5511999999999',
        mensagem: 'msg-confirmacao',
        tipo: 'confirmacao',
      },
    ])
  })

  it('grava log "falhou" e enfileira quando o envio retorna sucesso:false', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockReturnValue({
      nome: 'zapi',
      enviarMensagem: vi.fn().mockResolvedValue({ sucesso: false, erro: 'número inválido' }),
    })

    await criarAgendamento(null, formAgendamento())

    expect(inseridos.get(logsWhatsapp)).toEqual([
      expect.objectContaining({ evento: 'confirmacao_agendamento', status: 'falhou' }),
    ])
    expect(inseridos.get(whatsappQueue)).toEqual([
      expect.objectContaining({ agendamentoId: 'ag-1', tipo: 'confirmacao' }),
    ])
  })
})
