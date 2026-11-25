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
// Envio falso; listaDeEmails é o real. emailConfigurado segue as variáveis de ambiente.
vi.mock('@/lib/email/cliente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/cliente')>()),
  enviarEmail: vi.fn(),
}))

import { GET } from '@/app/api/cron/lembretes/route'
import { db } from '@/lib/db'
import { enviarEmail } from '@/lib/email/cliente'
import { getAgendamentosParaLembrete } from '@/lib/queries/appointments'

const mockEnviarEmail = vi.mocked(enviarEmail)
const SEGREDO = 'x'.repeat(40)
const req = () =>
  new Request('http://app/api/cron/lembretes', { headers: { authorization: `Bearer ${SEGREDO}` } }) as never

const AGORA = new Date('2026-11-22T15:00:00Z') // 12:00 BRT

function itemFila(over: Partial<Record<string, unknown>> = {}, ag: { agStatus: string | null; agData: string | null } = { agStatus: 'confirmado', agData: '2026-11-25' }) {
  return {
    item: {
      id: 'q1',
      agendamentoId: 'a1',
      destinatarios: 'maria@exemplo.com, outra@exemplo.com',
      assunto: 'Agendamento recebido',
      texto: 'oi',
      html: '<p>oi</p>',
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

function lembreteDeAmanha(email: string | null) {
  return {
    id: 'a2',
    data_agendada: '2026-11-23',
    hora_inicio: '09:00:00',
    hora_fim: '10:00:00',
    token_publico: 'tok',
    clientes: { nome: 'Maria', telefone: '+5511999990000', email },
  }
}

function configurarEmail(ativo: boolean) {
  if (ativo) {
    process.env.RESEND_API_KEY = 're_teste'
    process.env.EMAIL_FROM = 'Casa <contato@exemplo.com>'
  } else {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.AUTH_EMAIL_FROM
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AGORA)
  process.env.CRON_SECRET = SEGREDO
  vi.clearAllMocks()
  configurarEmail(true)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.mocked(console.error).mockRestore()
  vi.mocked(console.warn).mockRestore()
})

describe('GET /api/cron/lembretes', () => {
  it('reenvia item da fila para todos os destinatários e grava log', async () => {
    mockEnviarEmail.mockResolvedValue({ sucesso: true, idMensagem: 'm1' })
    filaMock.mockResolvedValue([itemFila()])

    const res = await (await GET(req())).json()

    expect(mockEnviarEmail).toHaveBeenCalledWith(['maria@exemplo.com', 'outra@exemplo.com'], {
      assunto: 'Agendamento recebido',
      texto: 'oi',
      html: '<p>oi</p>',
    })
    expect(res.retry).toMatchObject({ processados: 1, total: 1 })
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ tentativas: 1, status: 'enviado' }))
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        agendamentoId: 'a1',
        evento: 'confirmacao_agendamento',
        paraEmail: 'maria@exemplo.com, outra@exemplo.com',
        idMensagemProvedor: 'm1',
        status: 'enviado',
      })
    )
  })

  it('não grava log de item da Casa (tipo admin)', async () => {
    mockEnviarEmail.mockResolvedValue({ sucesso: true })
    filaMock.mockResolvedValue([itemFila({ tipo: 'admin' })])

    await GET(req())

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'enviado' }))
    expect(insertValues).not.toHaveBeenCalled()
  })

  it('sem e-mail configurado não envia nem consome tentativas da fila', async () => {
    configurarEmail(false)
    filaMock.mockResolvedValue([itemFila()])

    const res = await (await GET(req())).json()

    expect(mockEnviarEmail).not.toHaveBeenCalled()
    expect(updateSet).not.toHaveBeenCalled()
    expect(res.email_disponivel).toBe(false)
    expect(res.retry).toMatchObject({ processados: 0, falhas: 0, descartados: 0 })
  })

  it('descarta item de agendamento cancelado mesmo sem e-mail configurado', async () => {
    configurarEmail(false)
    filaMock.mockResolvedValue([itemFila({}, { agStatus: 'cancelado', agData: '2026-11-25' })])

    const res = await (await GET(req())).json()

    expect(updateSet).toHaveBeenCalledWith({ status: 'falhou' })
    expect(res.retry.descartados).toBe(1)
  })

  it('erro de rede no reenvio conta como tentativa', async () => {
    mockEnviarEmail.mockRejectedValue(new Error('ECONNRESET'))
    filaMock.mockResolvedValue([itemFila()])

    const res = await (await GET(req())).json()

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ tentativas: 1, status: 'pendente' }))
    expect(res.retry.falhas).toBe(1)
  })

  it('marca como falhou ao esgotar maxTentativas', async () => {
    mockEnviarEmail.mockResolvedValue({ sucesso: false, erro: 'x' })
    filaMock.mockResolvedValue([itemFila({ tentativas: 2, maxTentativas: 3 })])

    await GET(req())

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ tentativas: 3, status: 'falhou' }))
  })

  it('envia o lembrete de amanhã por e-mail, grava log e marca como enviado', async () => {
    mockEnviarEmail.mockResolvedValue({ sucesso: true, idMensagem: 'm2' })
    vi.mocked(getAgendamentosParaLembrete).mockResolvedValue([lembreteDeAmanha('maria@exemplo.com')] as never)
    filaMock.mockResolvedValue([])

    const res = await (await GET(req())).json()

    expect(mockEnviarEmail).toHaveBeenCalledWith(
      ['maria@exemplo.com'],
      expect.objectContaining({ assunto: expect.stringContaining('amanhã') })
    )
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ agendamentoId: 'a2', evento: 'lembrete_24h', status: 'enviado' })
    )
    expect(updateSet).toHaveBeenCalledWith({ lembreteEnviado: true })
    expect(res.horario).toMatchObject({ processados: 1, falhas: 0 })
  })

  it('pula consulente sem e-mail (cadastro antigo) sem marcar o lembrete', async () => {
    vi.mocked(getAgendamentosParaLembrete).mockResolvedValue([lembreteDeAmanha(null)] as never)
    filaMock.mockResolvedValue([])

    const res = await (await GET(req())).json()

    expect(mockEnviarEmail).not.toHaveBeenCalled()
    expect(updateSet).not.toHaveBeenCalled()
    expect(res.sem_email).toBe(1)
  })

  it('lembrete recusado pelo Resend não é marcado como enviado', async () => {
    mockEnviarEmail.mockResolvedValue({ sucesso: false, erro: 'domínio não verificado' })
    vi.mocked(getAgendamentosParaLembrete).mockResolvedValue([lembreteDeAmanha('maria@exemplo.com')] as never)
    filaMock.mockResolvedValue([])

    const res = await (await GET(req())).json()

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: 'falhou' }))
    expect(updateSet).not.toHaveBeenCalledWith({ lembreteEnviado: true })
    expect(res.horario).toMatchObject({ processados: 0, falhas: 1 })
  })

  it('não busca lembretes de horário antes das 09:00 de Brasília', async () => {
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z')) // 07:00 BRT
    filaMock.mockResolvedValue([])

    const res = await (await GET(req())).json()

    expect(getAgendamentosParaLembrete).not.toHaveBeenCalled()
    expect(res.horario.executado).toBe(false)
  })

  it('rejeita sem o segredo do cron', async () => {
    const res = await GET(new Request('http://app/api/cron/lembretes') as never)
    expect(res.status).toBe(401)
  })

  it.each([`Bearer ${'y'.repeat(40)}`, `Bearer ${SEGREDO}x`, 'Bearer '])(
    'rejeita segredo errado (%s)',
    async (cabecalho) => {
      const res = await GET(
        new Request('http://app/api/cron/lembretes', { headers: { authorization: cabecalho } }) as never
      )
      expect(res.status).toBe(401)
    }
  )

  describe('lembrete de evento (hora do evento no horário de Brasília)', () => {
    // Evento às 19:00 de Brasília (22:00 UTC) com lembrete 3 h antes: 16:00 BRT (19:00 UTC)
    const inscricao = {
      id: 'e1',
      dataAgendada: '2026-11-22',
      horaInicio: '19:00:00',
      horaFim: '21:00:00',
      tokenPublico: 'tok-e',
      cliente: { nome: 'Maria', email: 'maria@exemplo.com' },
      evento: { titulo: 'Gira de Pretos Velhos', horaInicio: '19:00:00', lembreteHoras: 3 },
    }

    beforeEach(() => {
      vi.mocked(db.query.agendamentos.findMany).mockResolvedValue([inscricao] as never)
      vi.mocked(getAgendamentosParaLembrete).mockResolvedValue([])
      filaMock.mockResolvedValue([])
      mockEnviarEmail.mockResolvedValue({ sucesso: true, idMensagem: 'm3' })
    })

    it('não envia antes da hora do lembrete (14:00 BRT)', async () => {
      vi.setSystemTime(new Date('2026-11-22T17:00:00Z'))
      const res = await (await GET(req())).json()
      expect(mockEnviarEmail).not.toHaveBeenCalled()
      expect(res.eventos.processados).toBe(0)
    })

    it('envia depois da hora do lembrete e antes do evento (16:30 BRT)', async () => {
      vi.setSystemTime(new Date('2026-11-22T19:30:00Z'))
      const res = await (await GET(req())).json()
      expect(mockEnviarEmail).toHaveBeenCalledWith(
        ['maria@exemplo.com'],
        expect.objectContaining({ assunto: expect.stringContaining('Gira de Pretos Velhos') })
      )
      expect(res.eventos.processados).toBe(1)
    })

    it('não envia depois que o evento começou (19:30 BRT)', async () => {
      vi.setSystemTime(new Date('2026-11-22T22:30:00Z'))
      await GET(req())
      expect(mockEnviarEmail).not.toHaveBeenCalled()
    })

    afterEach(() => {
      vi.mocked(db.query.agendamentos.findMany).mockResolvedValue([])
    })
  })
})
