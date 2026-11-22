// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const filaMock = vi.fn()
const updateSet = vi.fn()
const insertValues = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({ leftJoin: () => ({ where: () => filaMock() }) }),
    })),
    update: vi.fn(() => ({ set: (v: unknown) => { updateSet(v); return { where: vi.fn() } } })),
    insert: vi.fn(() => ({ values: (v: unknown) => insertValues(v) })),
    query: { agendamentos: { findMany: vi.fn(async () => []) } },
  },
}))
vi.mock('@/lib/queries/appointments', () => ({
  getAgendamentosParaLembrete: vi.fn(async () => []),
}))
vi.mock('@/lib/whatsapp/factory', () => ({ getProvedorWhatsApp: vi.fn() }))

import { GET } from '@/app/api/cron/lembretes/route'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { getAgendamentosParaLembrete } from '@/lib/queries/appointments'

const SEGREDO = 'x'.repeat(40)
const req = () =>
  new Request('http://app/api/cron/lembretes', { headers: { authorization: `Bearer ${SEGREDO}` } }) as never

const AGORA = new Date('2026-11-22T15:00:00Z') // 12:00 BRT

function itemFila(over: Partial<Record<string, unknown>> = {}, ag: { agStatus: string | null; agData: string | null } = { agStatus: 'confirmado', agData: '2026-11-25' }) {
  return {
    item: {
      id: 'q1',
      agendamentoId: 'a1',
      telefone: '+5511999990000',
      mensagem: 'oi',
      tipo: 'confirmacao',
      tentativas: 0,
      maxTentativas: 3,
      status: 'pendente',
      criadoEm: new Date(AGORA.getTime() - 3_600_000),
      proximoRetry: AGORA,
      ...over,
    },
    ...ag,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AGORA)
  process.env.CRON_SECRET = SEGREDO
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('GET /api/cron/lembretes', () => {
  it('processa a fila mesmo sem agendamentos para amanhã (sem retorno antecipado)', async () => {
    const enviarMensagem = vi.fn(async () => ({ sucesso: true, idMensagemProvedor: 'm1' }))
    vi.mocked(getProvedorWhatsApp).mockReturnValue({ nome: 'zapi', enviarMensagem } as never)
    filaMock.mockResolvedValue([itemFila()])

    const res = await (await GET(req())).json()

    expect(enviarMensagem).toHaveBeenCalledOnce()
    expect(res.retry).toMatchObject({ processados: 1, total: 1 })
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ tentativas: 1, status: 'enviado' }))
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ agendamentoId: 'a1', evento: 'confirmacao_agendamento', status: 'enviado' })
    )
  })

  it('sem provedor não consome tentativas da fila', async () => {
    vi.mocked(getProvedorWhatsApp).mockImplementation(() => {
      throw new Error('credenciais ausentes')
    })
    filaMock.mockResolvedValue([itemFila()])

    const res = await (await GET(req())).json()

    expect(updateSet).not.toHaveBeenCalled()
    expect(res.whatsapp_disponivel).toBe(false)
    expect(res.retry).toMatchObject({ processados: 0, falhas: 0, descartados: 0 })
  })

  it('descarta item de agendamento cancelado mesmo sem provedor', async () => {
    vi.mocked(getProvedorWhatsApp).mockImplementation(() => {
      throw new Error('credenciais ausentes')
    })
    filaMock.mockResolvedValue([itemFila({}, { agStatus: 'cancelado', agData: '2026-11-25' })])

    const res = await (await GET(req())).json()

    expect(updateSet).toHaveBeenCalledWith({ status: 'falhou' })
    expect(res.retry.descartados).toBe(1)
  })

  it('marca como falhou ao esgotar maxTentativas', async () => {
    const enviarMensagem = vi.fn(async () => ({ sucesso: false, erro: 'x' }))
    vi.mocked(getProvedorWhatsApp).mockReturnValue({ nome: 'zapi', enviarMensagem } as never)
    filaMock.mockResolvedValue([itemFila({ tentativas: 2, maxTentativas: 3 })])

    await GET(req())

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ tentativas: 3, status: 'falhou' }))
  })

  it('não busca lembretes de horário antes das 09:00 de Brasília', async () => {
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z')) // 07:00 BRT
    vi.mocked(getProvedorWhatsApp).mockReturnValue({ nome: 'zapi', enviarMensagem: vi.fn() } as never)
    filaMock.mockResolvedValue([])

    const res = await (await GET(req())).json()

    expect(getAgendamentosParaLembrete).not.toHaveBeenCalled()
    expect(res.horario.executado).toBe(false)
  })

  it('rejeita sem o segredo do cron', async () => {
    const res = await GET(new Request('http://app/api/cron/lembretes') as never)
    expect(res.status).toBe(401)
  })
})
