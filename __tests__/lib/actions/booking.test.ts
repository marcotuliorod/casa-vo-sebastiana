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
import { mensagemNovoAgendamentoAdmin, mensagemCancelamentoAdmin } from '@/lib/whatsapp/templates'
import { clientes, logsWhatsapp, whatsappQueue } from '@/lib/db/schema'
import { getSlotsDisponiveis } from '@/lib/queries/availability'
import { getEvento, contarInscritosOcorrencia } from '@/lib/queries/eventos'
import type { Evento } from '@/types/database'
import { cancelarAgendamento, criarAgendamento, inscreverEmEvento } from '@/lib/actions/booking'

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

function formAgendamento() {
  const fd = new FormData()
  fd.set('data', '2025-04-01')
  fd.set('hora_inicio', '09:00')
  fd.set('hora_fim', '10:00')
  fd.set('nome', 'Maria Silva')
  fd.set('telefone', '11999999999')
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

function formInscricao() {
  const fd = new FormData()
  fd.set('evento_id', EVENTO_ID)
  fd.set('data', '2025-04-05')
  fd.set('nome', 'Maria Silva')
  fd.set('telefone', '11999999999')
  return fd
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

// ─────────────────────────────────────────────────────────────────────────────
// inscreverEmEvento — confirmação via WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
describe('inscreverEmEvento — WhatsApp', () => {
  beforeEach(() => {
    // ehOcorrenciaValida (real) só aceita datas de hoje em diante: fixa "hoje" em 01/04/2025.
    // Só o Date é falsificado para não travar as promises.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-04-01T12:00:00-03:00'))
    vi.mocked(getEvento).mockResolvedValue(evento)
    vi.mocked(contarInscritosOcorrencia).mockResolvedValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('validação da data da ocorrência', () => {
    function formComData(data: string) {
      const fd = formInscricao()
      fd.set('data', data)
      return fd
    }

    it('rejeita data que não é ocorrência do evento (evento único em outro dia)', async () => {
      const resultado = await inscreverEmEvento(null, formComData('2025-04-06'))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(contarInscritosOcorrencia).not.toHaveBeenCalled()
      expect(mockDb.insert).not.toHaveBeenCalled()
      expect(mockGetProvedorWhatsApp).not.toHaveBeenCalled()
    })

    it('rejeita data que não bate com a recorrência semanal', async () => {
      vi.mocked(getEvento).mockResolvedValue({ ...evento, recorrencia: 'semanal' })

      // 05/04 é a primeira ocorrência; 09/04 fica no meio da semana
      const resultado = await inscreverEmEvento(null, formComData('2025-04-09'))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('rejeita ocorrência que já passou', async () => {
      vi.mocked(getEvento).mockResolvedValue({ ...evento, data_inicio: '2025-03-29', recorrencia: 'semanal' })

      // 29/03 é ocorrência semanal, mas é anterior a "hoje" (01/04)
      const resultado = await inscreverEmEvento(null, formComData('2025-03-29'))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('rejeita data após o fim da recorrência', async () => {
      vi.mocked(getEvento).mockResolvedValue({
        ...evento,
        recorrencia: 'semanal',
        data_fim_recorrencia: '2025-04-12',
      })

      const resultado = await inscreverEmEvento(null, formComData('2025-04-19'))

      expect(resultado).toEqual({ erro: 'Data inválida para este evento.' })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('aceita ocorrência semanal futura e segue para a inscrição', async () => {
      capturarInserts()
      mockGetProvedorWhatsApp.mockReturnValue({
        nome: 'zapi',
        enviarMensagem: vi.fn().mockResolvedValue({ sucesso: true }),
      })
      vi.mocked(getEvento).mockResolvedValue({ ...evento, recorrencia: 'semanal' })

      const resultado = await inscreverEmEvento(null, formComData('2025-04-12'))

      expect(resultado).toBeUndefined() // sucesso redireciona (redirect mockado)
      expect(contarInscritosOcorrencia).toHaveBeenCalledWith(EVENTO_ID, '2025-04-12')
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  it('enfileira a confirmação quando getProvedorWhatsApp lança (credenciais ausentes)', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockImplementation(() => {
      throw new Error('Z-API: configure ZAPI_INSTANCE_ID')
    })

    await inscreverEmEvento(null, formInscricao())

    expect(inseridos.get(whatsappQueue)).toEqual([
      {
        agendamentoId: 'ag-1',
        telefone: '+5511999999999',
        mensagem: 'msg-confirmacao-evento',
        tipo: 'confirmacao',
      },
    ])
    expect(console.error).toHaveBeenCalled()
  })

  it('grava log "falhou" e enfileira quando o envio retorna sucesso:false', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockReturnValue({
      nome: 'zapi',
      enviarMensagem: vi.fn().mockResolvedValue({ sucesso: false, erro: 'número inválido' }),
    })

    await inscreverEmEvento(null, formInscricao())

    expect(inseridos.get(logsWhatsapp)).toEqual([
      expect.objectContaining({
        agendamentoId: 'ag-1',
        evento: 'confirmacao_agendamento',
        status: 'falhou',
        mensagemErro: 'número inválido',
      }),
    ])
    expect(inseridos.get(whatsappQueue)).toEqual([
      expect.objectContaining({ agendamentoId: 'ag-1', mensagem: 'msg-confirmacao-evento', tipo: 'confirmacao' }),
    ])
  })

  it('grava log "enviado" e não enfileira quando o envio dá certo', async () => {
    const inseridos = capturarInserts()
    mockGetProvedorWhatsApp.mockReturnValue({
      nome: 'zapi',
      enviarMensagem: vi.fn().mockResolvedValue({ sucesso: true, idMensagemProvedor: 'm-1' }),
    })

    await inscreverEmEvento(null, formInscricao())

    expect(inseridos.get(logsWhatsapp)).toEqual([
      expect.objectContaining({ status: 'enviado', idMensagemProvedor: 'm-1' }),
    ])
    expect(inseridos.has(whatsappQueue)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Notificação ao admin (ADMIN_WHATSAPP)
// Falha vira item da fila (tipo 'admin'), sem log em logs_whatsapp (histórico do consulente).
// ─────────────────────────────────────────────────────────────────────────────
describe('notificação ao admin via WhatsApp', () => {
  const ADMIN = '+5511900000000'

  /** Provedor que registra os envios; opcionalmente falha só para o admin */
  function mkProvedor(opcoes: { falharAdmin?: 'lanca' | 'sucesso_false' } = {}) {
    return {
      nome: 'zapi',
      enviarMensagem: vi.fn(async ({ para }: { para: string }) => {
        if (para === ADMIN && opcoes.falharAdmin === 'lanca') throw new Error('timeout admin')
        if (para === ADMIN && opcoes.falharAdmin === 'sucesso_false') {
          return { sucesso: false, erro: 'falhou admin' }
        }
        return { sucesso: true, idMensagemProvedor: `m-${para}` }
      }),
    }
  }

  function enviosParaAdmin(provedor: ReturnType<typeof mkProvedor>) {
    return provedor.enviarMensagem.mock.calls.filter(([m]) => m.para === ADMIN).map(([m]) => m)
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2025-04-01T12:00:00-03:00'))
    delete process.env.MAX_AGENDAMENTOS_MES
    vi.mocked(getSlotsDisponiveis).mockResolvedValue({
      slots: [{ hora_inicio: '09:00', hora_fim: '10:00' }],
    } as unknown as Awaited<ReturnType<typeof getSlotsDisponiveis>>)
    vi.mocked(getEvento).mockResolvedValue(evento)
    vi.mocked(contarInscritosOcorrencia).mockResolvedValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Cada ação com o template esperado e os dados que devem chegar nele
  const casos = [
    {
      nome: 'criarAgendamento (novo agendamento)',
      executar: () => criarAgendamento(null, formAgendamento()),
      template: mensagemNovoAgendamentoAdmin,
      corpo: 'msg-novo-admin',
      agendamentoIdFila: 'ag-1',
      dados: {
        nomeCliente: 'Maria Silva',
        telefoneCliente: '+5511999999999',
        dataAgendada: '2025-04-01',
        horaInicio: '09:00',
        horaFim: '10:00',
      },
    },
    {
      nome: 'inscreverEmEvento (nova inscrição)',
      executar: () => inscreverEmEvento(null, formInscricao()),
      template: mensagemNovoAgendamentoAdmin,
      corpo: 'msg-novo-admin',
      agendamentoIdFila: 'ag-1',
      dados: {
        nomeCliente: 'Maria Silva',
        telefoneCliente: '+5511999999999',
        dataAgendada: '2025-04-05',
        horaInicio: '19:00', // hora do evento sem segundos
        horaFim: '21:00',
      },
    },
    {
      nome: 'cancelarAgendamento (cancelamento pelo consulente)',
      executar: () => cancelarAgendamento('tok-abc'),
      template: mensagemCancelamentoAdmin,
      corpo: 'msg-cancelamento-admin',
      // Sem vínculo: o cron descartaria item de agendamento cancelado
      agendamentoIdFila: null,
      dados: {
        nomeCliente: 'Maria',
        telefoneCliente: '+5511999999999',
        dataAgendada: '2025-04-01',
        horaInicio: '09:00',
        horaFim: '10:00',
      },
    },
  ]

  describe.each(casos)('$nome', ({ executar, template, corpo, dados, agendamentoIdFila }) => {
    it('envia ao ADMIN_WHATSAPP com os dados do agendamento', async () => {
      process.env.ADMIN_WHATSAPP = ADMIN
      const inseridos = capturarInserts()
      const provedor = mkProvedor()
      mockGetProvedorWhatsApp.mockReturnValue(provedor)

      await executar()

      expect(template).toHaveBeenCalledWith(dados)
      expect(enviosParaAdmin(provedor)).toEqual([{ para: ADMIN, corpo }])
      expect(inseridos.has(whatsappQueue)).toBe(false)
      // Só o consulente entra no histórico
      expect(inseridos.get(logsWhatsapp)).toEqual([
        expect.objectContaining({ paraTelefone: '+5511999999999' }),
      ])
    })

    it('não notifica o admin quando ADMIN_WHATSAPP não está configurado', async () => {
      capturarInserts()
      const provedor = mkProvedor()
      mockGetProvedorWhatsApp.mockReturnValue(provedor)

      await executar()

      expect(template).not.toHaveBeenCalled()
      expect(enviosParaAdmin(provedor)).toEqual([])
      // A mensagem ao consulente continua sendo enviada
      expect(provedor.enviarMensagem).toHaveBeenCalledOnce()
    })

    const itemFilaAdmin = () => ({
      agendamentoId: agendamentoIdFila,
      telefone: ADMIN,
      mensagem: corpo,
      tipo: 'admin',
    })

    it('enfileira (sem log) quando o envio ao admin lança, sem afetar o consulente', async () => {
      process.env.ADMIN_WHATSAPP = ADMIN
      const inseridos = capturarInserts()
      mockGetProvedorWhatsApp.mockReturnValue(mkProvedor({ falharAdmin: 'lanca' }))

      const resultado = await executar()

      // Ações com redirect (mockado) retornam undefined; o cancelamento retorna {}
      expect(resultado === undefined || JSON.stringify(resultado) === '{}').toBe(true)
      expect(inseridos.get(whatsappQueue)).toEqual([itemFilaAdmin()])
      expect(inseridos.get(logsWhatsapp)).toEqual([
        expect.objectContaining({ paraTelefone: '+5511999999999', status: 'enviado' }),
      ])
      expect(console.error).toHaveBeenCalled()
    })

    it('enfileira (sem log) quando o envio ao admin retorna sucesso:false', async () => {
      process.env.ADMIN_WHATSAPP = ADMIN
      const inseridos = capturarInserts()
      mockGetProvedorWhatsApp.mockReturnValue(mkProvedor({ falharAdmin: 'sucesso_false' }))

      await executar()

      expect(inseridos.get(whatsappQueue)).toEqual([itemFilaAdmin()])
      expect(inseridos.get(logsWhatsapp)).toEqual([
        expect.objectContaining({ paraTelefone: '+5511999999999', status: 'enviado' }),
      ])
    })

    it('enfileira consulente e admin quando o provedor está indisponível', async () => {
      process.env.ADMIN_WHATSAPP = ADMIN
      const inseridos = capturarInserts()
      mockGetProvedorWhatsApp.mockImplementation(() => {
        throw new Error('Z-API: configure ZAPI_INSTANCE_ID')
      })

      await executar()

      const fila = inseridos.get(whatsappQueue) as Array<{ tipo: string }>
      expect(fila.map((i) => i.tipo)).toEqual([expect.not.stringMatching(/^admin$/), 'admin'])
      expect(fila[1]).toEqual(itemFilaAdmin())
      expect(inseridos.has(logsWhatsapp)).toBe(false)
    })
  })
})
