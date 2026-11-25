import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks globais ─────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => {
  const db: Record<string, unknown> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      agendamentos: { findFirst: vi.fn() },
      mediuns: { findFirst: vi.fn() },
    },
  }
  // A transação recebe o próprio mock como `tx`
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return { db }
})
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}))
// Só o envio é falso; listaDeEmails e afins são os reais
vi.mock('@/lib/email/cliente', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/cliente')>()),
  enviarEmail: vi.fn(),
}))
vi.mock('@/lib/email/templates', () => ({
  emailCancelamento: vi.fn(() => ({ assunto: 'assunto-cancelamento', texto: 'texto-cancelamento', html: 'html-cancelamento' })),
  emailAtribuicaoMedium: vi.fn(() => ({ assunto: 'assunto-medium', texto: 'texto-medium', html: 'html-medium' })),
}))

import { db } from '@/lib/db'
import { auth } from '@/lib/auth/config'
import { enviarEmail } from '@/lib/email/cliente'
import { emailAtribuicaoMedium } from '@/lib/email/templates'
import { agendamentos, clientes, emailQueue, logsEmail, mediuns } from '@/lib/db/schema'
import {
  atualizarStatusAgendamento,
  bloquearData,
  desbloquearData,
  toggleHorarioGrade,
  ativarNovoSlot,
  atualizarGradeHorarios,
  criarMedium,
  toggleMediumAtivo,
  atribuirMedium,
  criarEvento,
  editarEvento,
  toggleEventoAtivo,
  excluirEvento,
  editarAgendamento,
  excluirAgendamento,
  editarCliente,
  excluirCliente,
  editarMedium,
  excluirMedium,
} from '@/lib/actions/admin'

type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  query: {
    agendamentos: { findFirst: ReturnType<typeof vi.fn> }
    mediuns: { findFirst: ReturnType<typeof vi.fn> }
  }
}
const mockDb = db as unknown as MockDb
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockEnviarEmail = vi.mocked(enviarEmail)

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Mocks do encadeamento fluente do Drizzle. Cada helper cobre a "forma" de
// chain usada por lib/actions/admin.ts para aquele tipo de operação.

/** db.select({value: count()}).from(t).where(cond) → [{ value }] */
function mkCountChain(value: number) {
  return { from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([{ value }])) })) }
}

/** db.update(t).set(v).where(cond) */
function mkUpdateChain(erro?: Error) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => (erro ? Promise.reject(erro) : Promise.resolve([]))),
    })),
  }
}

/** db.delete(t).where(cond) */
function mkDeleteChain(erro?: Error) {
  return { where: vi.fn(() => (erro ? Promise.reject(erro) : Promise.resolve([]))) }
}

/**
 * db.insert(t).values(v) — thenable direto — e também
 * db.insert(t).values(v).onConflictDoUpdate(...) (usado na grade de horários).
 */
function mkInsertChain(erro?: Error) {
  const resolvePromise = () => (erro ? Promise.reject(erro) : Promise.resolve([]))
  return {
    values: vi.fn(() => ({
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        resolvePromise().then(res, rej),
      catch: (rej: (e: unknown) => unknown) => resolvePromise().catch(rej),
      onConflictDoUpdate: vi.fn(() => resolvePromise()),
    })),
  }
}

/** Mock de sessão Auth.js autenticada */
function mkSessionClient(user: { email: string; id: string } | null) {
  return user ? { user, expires: '2099-01-01T00:00:00.000Z' } : null
}

/** Helpers para FormData */
function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ADMIN_EMAILS = '' // sem restrição de email (qualquer user autenticado é admin)

  // Por padrão, retornar admin autorizado
  mockAuth.mockResolvedValue(mkSessionClient({ email: 'admin@test.com', id: 'uid-admin' }))
})

// ─────────────────────────────────────────────────────────────────────────────
// atualizarStatusAgendamento
// ─────────────────────────────────────────────────────────────────────────────
describe('atualizarStatusAgendamento', () => {
  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))

    const resultado = await atualizarStatusAgendamento('ag-1', 'confirmado')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('retorna erro quando DB falha no update', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('DB error')))

    const resultado = await atualizarStatusAgendamento('ag-1', 'confirmado')
    expect(resultado).toEqual({ erro: 'DB error' })
  })

  it('atualiza status com sucesso (sem e-mail para status != cancelado)', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())

    const resultado = await atualizarStatusAgendamento('ag-1', 'confirmado')
    expect(resultado).toEqual({})
    expect(mockEnviarEmail).not.toHaveBeenCalled()
  })

  describe('e-mail ao consulente quando o admin cancela', () => {
    const agCancelado = {
      id: 'ag-1',
      dataAgendada: '2025-04-01',
      horaInicio: '09:00:00',
      horaFim: '10:00:00',
      tokenPublico: 'tok-abc',
      cliente: { nome: 'Pedro', telefone: '+5511988888888', email: 'pedro@exemplo.com' },
    }
    let valoresInseridos: Map<unknown, unknown[]>

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockDb.update.mockReturnValue(mkUpdateChain())
      mockDb.query.agendamentos.findFirst.mockResolvedValue(agCancelado)
      valoresInseridos = new Map()
      mockDb.insert.mockImplementation((tabela: unknown) => ({
        values: vi.fn((v: unknown) => {
          valoresInseridos.set(tabela, [...(valoresInseridos.get(tabela) ?? []), v])
          return Promise.resolve([])
        }),
      }))
    })

    afterEach(() => {
      vi.mocked(console.error).mockRestore()
      vi.mocked(console.warn).mockRestore()
    })

    const itemFilaEsperado = {
      agendamentoId: 'ag-1',
      destinatarios: 'pedro@exemplo.com',
      assunto: 'assunto-cancelamento',
      texto: 'texto-cancelamento',
      html: 'html-cancelamento',
      tipo: 'cancelamento',
    }

    it('envia para o e-mail do consulente e grava log "enviado"', async () => {
      mockEnviarEmail.mockResolvedValue({ sucesso: true, idMensagem: 'm-1' })

      const resultado = await atualizarStatusAgendamento('ag-1', 'cancelado')

      expect(resultado).toEqual({})
      expect(mockEnviarEmail).toHaveBeenCalledWith(['pedro@exemplo.com'], expect.objectContaining({ assunto: 'assunto-cancelamento' }))
      expect(valoresInseridos.get(logsEmail)).toEqual([
        expect.objectContaining({ evento: 'cancelamento', status: 'enviado', idMensagemProvedor: 'm-1' }),
      ])
      expect(valoresInseridos.has(emailQueue)).toBe(false)
    })

    it('enfileira quando o envio lança (ex.: e-mail não configurado)', async () => {
      mockEnviarEmail.mockRejectedValue(new Error('E-mail: configure RESEND_API_KEY e EMAIL_FROM no .env'))

      const resultado = await atualizarStatusAgendamento('ag-1', 'cancelado')

      expect(resultado).toEqual({})
      expect(valoresInseridos.get(emailQueue)).toEqual([itemFilaEsperado])
      expect(console.error).toHaveBeenCalled()
    })

    it('grava log "falhou" e enfileira quando o Resend recusa', async () => {
      mockEnviarEmail.mockResolvedValue({ sucesso: false, erro: 'domínio não verificado' })

      const resultado = await atualizarStatusAgendamento('ag-1', 'cancelado')

      expect(resultado).toEqual({})
      expect(valoresInseridos.get(logsEmail)).toEqual([
        expect.objectContaining({
          agendamentoId: 'ag-1',
          evento: 'cancelamento',
          paraEmail: 'pedro@exemplo.com',
          status: 'falhou',
          mensagemErro: 'domínio não verificado',
        }),
      ])
      expect(valoresInseridos.get(emailQueue)).toEqual([itemFilaEsperado])
    })

    it('consulente sem e-mail: cancela sem enviar nem enfileirar', async () => {
      mockDb.query.agendamentos.findFirst.mockResolvedValue({
        ...agCancelado,
        cliente: { ...agCancelado.cliente, email: null },
      })

      const resultado = await atualizarStatusAgendamento('ag-1', 'cancelado')

      expect(resultado).toEqual({})
      expect(mockEnviarEmail).not.toHaveBeenCalled()
      expect(valoresInseridos.has(emailQueue)).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// bloquearData
// ─────────────────────────────────────────────────────────────────────────────
describe('bloquearData', () => {
  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const fd = makeFormData({ data: '2025-05-01' })
    const resultado = await bloquearData(null, fd)
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('retorna erro de validação para data inválida', async () => {
    const fd = makeFormData({ data: 'nao-e-data' })
    const resultado = await bloquearData(null, fd)
    expect(resultado.erro).toBeDefined()
  })

  it('bloqueia dia inteiro (sem hora) com sucesso', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    const fd = makeFormData({ data: '2025-05-01' })
    const resultado = await bloquearData(null, fd)
    expect(resultado).toEqual({})
  })

  it('bloqueia horário específico com sucesso', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    const fd = makeFormData({ data: '2025-05-01', hora_inicio: '09:00', hora_fim: '10:00' })
    const resultado = await bloquearData(null, fd)
    expect(resultado).toEqual({})
  })

  it('retorna erro de duplicação (código 23505)', async () => {
    const erro = Object.assign(new Error('duplicate'), { cause: { code: '23505' } })
    mockDb.insert.mockReturnValue(mkInsertChain(erro))
    const fd = makeFormData({ data: '2025-05-01', hora_inicio: '09:00' })
    const resultado = await bloquearData(null, fd)
    expect(resultado).toEqual({ erro: 'Este horário já está bloqueado.' })
  })

  it('retorna erro genérico de DB', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain(new Error('constraint violation')))
    const fd = makeFormData({ data: '2025-05-01' })
    const resultado = await bloquearData(null, fd)
    expect(resultado).toEqual({ erro: 'constraint violation' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// desbloquearData
// ─────────────────────────────────────────────────────────────────────────────
describe('desbloquearData', () => {
  it('desbloqueia com sucesso', async () => {
    mockDb.delete.mockReturnValue(mkDeleteChain())
    const resultado = await desbloquearData('bloq-1')
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB', async () => {
    mockDb.delete.mockReturnValue(mkDeleteChain(new Error('not found')))
    const resultado = await desbloquearData('bloq-1')
    expect(resultado).toEqual({ erro: 'not found' })
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await desbloquearData('bloq-1')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toggleHorarioGrade
// ─────────────────────────────────────────────────────────────────────────────
describe('toggleHorarioGrade', () => {
  it('ativa um slot com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await toggleHorarioGrade('slot-1', true)
    expect(resultado).toEqual({})
  })

  it('desativa um slot com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await toggleHorarioGrade('slot-1', false)
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('DB fail')))
    const resultado = await toggleHorarioGrade('slot-1', true)
    expect(resultado).toEqual({ erro: 'DB fail' })
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await toggleHorarioGrade('slot-1', true)
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ativarNovoSlot
// ─────────────────────────────────────────────────────────────────────────────
describe('ativarNovoSlot', () => {
  it('insere novo slot com sucesso', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    const resultado = await ativarNovoSlot(2, '09:00', '10:00')
    expect(resultado).toEqual({})
  })

  it('propaga erro de DB (não falha silenciosamente)', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain(new Error('upsert fail')))
    const resultado = await ativarNovoSlot(2, '09:00', '10:00')
    expect(resultado).toEqual({ erro: 'upsert fail' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// atualizarGradeHorarios
// ─────────────────────────────────────────────────────────────────────────────
describe('atualizarGradeHorarios', () => {
  it('retorna erro para formato de hora inválido', async () => {
    const resultado = await atualizarGradeHorarios(2, [
      { hora_inicio: '9:0', hora_fim: '10:00', ativo: true },
    ])
    expect(resultado).toEqual({ erro: 'Formato de hora inválido.' })
  })

  it('remove todos os slots quando lista está vazia', async () => {
    mockDb.delete.mockReturnValue(mkDeleteChain())
    const resultado = await atualizarGradeHorarios(2, [])
    expect(resultado).toEqual({})
  })

  it('faz upsert e remove slots obsoletos com lista preenchida', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    mockDb.delete.mockReturnValue(mkDeleteChain())
    const resultado = await atualizarGradeHorarios(2, [
      { hora_inicio: '09:00', hora_fim: '10:00', ativo: true },
    ])
    expect(resultado).toEqual({})
  })

  it('retorna erro se upsert falhar', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain(new Error('upsert error')))
    const resultado = await atualizarGradeHorarios(2, [
      { hora_inicio: '09:00', hora_fim: '10:00', ativo: true },
    ])
    expect(resultado).toEqual({ erro: 'upsert error' })
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await atualizarGradeHorarios(2, [])
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// criarMedium
// ─────────────────────────────────────────────────────────────────────────────
describe('criarMedium', () => {
  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const fd = makeFormData({ nome: 'Maria' })
    const resultado = await criarMedium(null, fd)
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('retorna erro de validação para nome muito curto', async () => {
    const fd = makeFormData({ nome: 'A' })
    const resultado = await criarMedium(null, fd)
    expect(resultado.erro).toBeDefined()
  })

  it('cria médium com sucesso', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    const fd = makeFormData({ nome: 'Maria Silva', especialidade: 'Cura', telefone: '11999999999' })
    const resultado = await criarMedium(null, fd)
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain(new Error('insert error')))
    const fd = makeFormData({ nome: 'Maria Silva' })
    const resultado = await criarMedium(null, fd)
    expect(resultado).toEqual({ erro: 'insert error' })
  })

  it('salva o e-mail do médium normalizado', async () => {
    const chain = mkInsertChain()
    mockDb.insert.mockReturnValue(chain)
    const fd = makeFormData({ nome: 'Maria Silva', email: ' Maria@Exemplo.com ' })

    const resultado = await criarMedium(null, fd)

    expect(resultado).toEqual({})
    expect(mockDb.insert).toHaveBeenCalledWith(mediuns)
    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({ email: 'maria@exemplo.com' }))
  })

  it('rejeita e-mail inválido do médium', async () => {
    const fd = makeFormData({ nome: 'Maria Silva', email: 'maria@' })
    const resultado = await criarMedium(null, fd)
    expect(resultado).toEqual({ erro: 'E-mail inválido' })
  })

  it('cria médium sem especialidade e telefone (campos opcionais)', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    const fd = makeFormData({ nome: 'Carlos Lima' })
    const resultado = await criarMedium(null, fd)
    expect(resultado).toEqual({})
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toggleMediumAtivo
// ─────────────────────────────────────────────────────────────────────────────
describe('toggleMediumAtivo', () => {
  it('ativa médium com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await toggleMediumAtivo('med-1', true)
    expect(resultado).toEqual({})
  })

  it('desativa médium com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await toggleMediumAtivo('med-1', false)
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('update fail')))
    const resultado = await toggleMediumAtivo('med-1', true)
    expect(resultado).toEqual({ erro: 'update fail' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// atribuirMedium
// ─────────────────────────────────────────────────────────────────────────────
describe('atribuirMedium', () => {
  const agendamento = {
    id: 'ag-1',
    dataAgendada: '2025-04-01',
    horaInicio: '09:00:00',
    horaFim: '10:00:00',
    cliente: { nome: 'Ana' },
  }
  let valoresInseridos: Map<unknown, unknown[]>

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockDb.update.mockReturnValue(mkUpdateChain())
    mockDb.query.agendamentos.findFirst.mockResolvedValue(agendamento)
    valoresInseridos = new Map()
    mockDb.insert.mockImplementation((tabela: unknown) => ({
      values: vi.fn((v: unknown) => {
        valoresInseridos.set(tabela, [...(valoresInseridos.get(tabela) ?? []), v])
        return Promise.resolve([])
      }),
    }))
  })

  afterEach(() => {
    vi.mocked(console.error).mockRestore()
  })

  it('retorna erro de DB no update', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('update fail')))
    const resultado = await atribuirMedium('ag-1', 'med-1')
    expect(resultado).toEqual({ erro: 'update fail' })
  })

  it('avisa o médium por e-mail quando ele tem e-mail cadastrado', async () => {
    mockEnviarEmail.mockResolvedValue({ sucesso: true, idMensagem: 'm-1' })
    mockDb.query.mediuns.findFirst.mockResolvedValue({ nome: 'João', email: 'joao@exemplo.com' })

    const resultado = await atribuirMedium('ag-1', 'med-1')

    expect(resultado).toEqual({})
    expect(emailAtribuicaoMedium).toHaveBeenCalledWith({
      nomeMedium: 'João',
      nomeCliente: 'Ana',
      dataAgendada: '2025-04-01',
      horaInicio: '09:00',
      horaFim: '10:00',
    })
    expect(mockEnviarEmail).toHaveBeenCalledWith(['joao@exemplo.com'], expect.objectContaining({ assunto: 'assunto-medium' }))
    // Aviso ao médium não entra no histórico do consulente
    expect(valoresInseridos.has(logsEmail)).toBe(false)
  })

  it('não envia nada quando o médium não tem e-mail', async () => {
    mockDb.query.mediuns.findFirst.mockResolvedValue({ nome: 'João', email: null, telefone: '11988888888' })

    const resultado = await atribuirMedium('ag-1', 'med-1')

    expect(resultado).toEqual({})
    expect(mockEnviarEmail).not.toHaveBeenCalled()
  })

  it('enfileira o aviso (tipo medium) quando o envio falha, sem impedir a atribuição', async () => {
    mockEnviarEmail.mockRejectedValue(new Error('timeout'))
    mockDb.query.mediuns.findFirst.mockResolvedValue({ nome: 'João', email: 'joao@exemplo.com' })

    const resultado = await atribuirMedium('ag-1', 'med-1')

    expect(resultado).toEqual({})
    expect(valoresInseridos.get(emailQueue)).toEqual([
      {
        agendamentoId: 'ag-1',
        destinatarios: 'joao@exemplo.com',
        assunto: 'assunto-medium',
        texto: 'texto-medium',
        html: 'html-medium',
        tipo: 'medium',
      },
    ])
  })

  it('não envia e-mail quando mediumId é vazio (remoção de atribuição)', async () => {
    const resultado = await atribuirMedium('ag-1', '')
    expect(resultado).toEqual({})
    expect(mockEnviarEmail).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// criarEvento
// ─────────────────────────────────────────────────────────────────────────────
describe('criarEvento', () => {
  const eventValido = {
    titulo: 'Palestra de Meditação',
    data_inicio: '2025-06-01',
    hora_inicio: '09:00',
    hora_fim: '11:00',
    capacidade: '20',
    recorrencia: 'nenhuma',
    lembrete_horas: '24',
  }

  it('cria evento com sucesso', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    const fd = makeFormData(eventValido)
    const resultado = await criarEvento(null, fd)
    expect(resultado).toEqual({ ok: true })
  })

  it('retorna um objeto novo a cada sucesso (necessário para o useFormState disparar efeitos)', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain())
    const a = await criarEvento(null, makeFormData(eventValido))
    const b = await criarEvento(a, makeFormData(eventValido))
    expect(b).not.toBe(a)
  })

  it('retorna erro para título muito curto', async () => {
    const fd = makeFormData({ ...eventValido, titulo: 'AB' })
    const resultado = await criarEvento(null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('retorna erro quando hora_fim <= hora_inicio', async () => {
    const fd = makeFormData({ ...eventValido, hora_fim: '08:00' })
    const resultado = await criarEvento(null, fd)
    expect(resultado?.erro).toMatch(/hora de fim/i)
    expect(resultado?.campo).toBe('hora_fim')
  })

  it('retorna erro para capacidade fora do range (> 500)', async () => {
    const fd = makeFormData({ ...eventValido, capacidade: '501' })
    const resultado = await criarEvento(null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('retorna erro de DB', async () => {
    mockDb.insert.mockReturnValue(mkInsertChain(new Error('insert fail')))
    const fd = makeFormData(eventValido)
    const resultado = await criarEvento(null, fd)
    expect(resultado?.erro).toBe('insert fail')
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const fd = makeFormData(eventValido)
    const resultado = await criarEvento(null, fd)
    expect(resultado?.erro).toBe('Não autorizado.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// editarEvento
// ─────────────────────────────────────────────────────────────────────────────
describe('editarEvento', () => {
  const eventoValido = {
    titulo: 'Ritual Semanal',
    data_inicio: '2025-06-01',
    hora_inicio: '14:00',
    hora_fim: '16:00',
    capacidade: '10',
    recorrencia: 'semanal',
    lembrete_horas: '48',
  }

  it('edita evento com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const fd = makeFormData(eventoValido)
    const resultado = await editarEvento('ev-1', null, fd)
    expect(resultado).toEqual({ ok: true })
  })

  it('salva a descrição com quebras de linha normalizadas (\\r\\n vira \\n)', async () => {
    const set = vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) }))
    mockDb.update.mockReturnValue({ set })

    const resultado = await editarEvento(
      'ev-1',
      null,
      makeFormData({ ...eventoValido, descricao: '**Linha 1**\r\n\r\nLinha 2' })
    )

    expect(resultado).toEqual({ ok: true })
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ descricao: '**Linha 1**\n\nLinha 2' }))
  })

  it('\\r\\n não conta em dobro no limite de 1000 caracteres', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    // 250 linhas de "aaa": 1248 caracteres com \r\n, 999 depois de normalizar para \n
    const descricao = Array.from({ length: 250 }, () => 'aaa').join('\r\n')
    expect(descricao.length).toBeGreaterThan(1000)
    expect(descricao.replace(/\r\n/g, '\n').length).toBeLessThanOrEqual(1000)

    const resultado = await editarEvento('ev-1', null, makeFormData({ ...eventoValido, descricao }))
    expect(resultado).toEqual({ ok: true })
  })

  it('rejeita descrição acima de 1000 caracteres e informa o campo', async () => {
    const resultado = await editarEvento(
      'ev-1',
      null,
      makeFormData({ ...eventoValido, descricao: 'a'.repeat(1001) })
    )
    expect(resultado?.campo).toBe('descricao')
    expect(resultado?.erro).toBeTruthy()
    expect(resultado?.ok).toBeUndefined()
  })

  it('retorna erro quando hora_fim igual a hora_inicio', async () => {
    const fd = makeFormData({ ...eventoValido, hora_fim: '14:00' })
    const resultado = await editarEvento('ev-1', null, fd)
    expect(resultado?.erro).toMatch(/hora de fim/i)
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const fd = makeFormData(eventoValido)
    const resultado = await editarEvento('ev-1', null, fd)
    expect(resultado?.erro).toBe('Não autorizado.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toggleEventoAtivo
// ─────────────────────────────────────────────────────────────────────────────
describe('toggleEventoAtivo', () => {
  it('ativa evento com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await toggleEventoAtivo('ev-1', true)
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('update fail')))
    const resultado = await toggleEventoAtivo('ev-1', false)
    expect(resultado).toEqual({ erro: 'update fail' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// excluirEvento
// ─────────────────────────────────────────────────────────────────────────────
describe('excluirEvento', () => {
  it('bloqueia exclusão quando há inscrições ativas', async () => {
    mockDb.select.mockReturnValue(mkCountChain(3))
    const resultado = await excluirEvento('ev-1')
    expect(resultado.erro).toMatch(/3 inscrição/)
  })

  it('exclui evento sem inscrições ativas', async () => {
    mockDb.select.mockReturnValue(mkCountChain(0))
    mockDb.delete
      .mockReturnValueOnce(mkDeleteChain()) // delete históricos (agendamentos)
      .mockReturnValueOnce(mkDeleteChain()) // delete evento
    const resultado = await excluirEvento('ev-1')
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB na exclusão do evento', async () => {
    mockDb.select.mockReturnValue(mkCountChain(0))
    mockDb.delete
      .mockReturnValueOnce(mkDeleteChain()) // delete históricos ok
      .mockReturnValueOnce(mkDeleteChain(new Error('delete fail'))) // delete evento falha
    const resultado = await excluirEvento('ev-1')
    expect(resultado).toEqual({ erro: 'delete fail' })
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await excluirEvento('ev-1')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// editarAgendamento
// ─────────────────────────────────────────────────────────────────────────────
describe('editarAgendamento', () => {
  const agValido = {
    data_agendada: '2025-05-10',
    hora_inicio: '09:00',
    hora_fim: '10:00',
  }

  it('edita agendamento com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const fd = makeFormData(agValido)
    const resultado = await editarAgendamento('ag-1', null, fd)
    expect(resultado).toEqual({ ok: true })
  })

  it('retorna erro quando hora_fim <= hora_inicio', async () => {
    const fd = makeFormData({ ...agValido, hora_fim: '08:00' })
    const resultado = await editarAgendamento('ag-1', null, fd)
    expect(resultado?.erro).toMatch(/hora de fim/i)
    expect(resultado?.campo).toBe('hora_fim')
  })

  it('retorna erro de validação para data inválida', async () => {
    const fd = makeFormData({ ...agValido, data_agendada: '01/05/2025' })
    const resultado = await editarAgendamento('ag-1', null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('retorna erro de DB', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('update fail')))
    const fd = makeFormData(agValido)
    const resultado = await editarAgendamento('ag-1', null, fd)
    expect(resultado?.erro).toBe('update fail')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// excluirAgendamento
// ─────────────────────────────────────────────────────────────────────────────
describe('excluirAgendamento', () => {
  it('exclui agendamento com sucesso', async () => {
    mockDb.delete.mockReturnValue(mkDeleteChain())
    const resultado = await excluirAgendamento('ag-1')
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB', async () => {
    mockDb.delete.mockReturnValue(mkDeleteChain(new Error('delete fail')))
    const resultado = await excluirAgendamento('ag-1')
    expect(resultado).toEqual({ erro: 'delete fail' })
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await excluirAgendamento('ag-1')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// editarCliente
// ─────────────────────────────────────────────────────────────────────────────
describe('editarCliente', () => {
  const clienteValido = {
    nome: 'Ana Silva',
    telefone: '11999999999',
    email: '',
    notas: '',
  }

  it('edita cliente com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const fd = makeFormData(clienteValido)
    const resultado = await editarCliente('cli-1', null, fd)
    expect(resultado).toEqual({ ok: true })
  })

  it('retorna erro para nome muito curto', async () => {
    const fd = makeFormData({ ...clienteValido, nome: 'A' })
    const resultado = await editarCliente('cli-1', null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('retorna erro para telefone muito curto', async () => {
    const fd = makeFormData({ ...clienteValido, telefone: '123' })
    const resultado = await editarCliente('cli-1', null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('retorna erro para email inválido', async () => {
    const fd = makeFormData({ ...clienteValido, email: 'nao-e-email' })
    const resultado = await editarCliente('cli-1', null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('aceita email vazio (campo opcional)', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const fd = makeFormData({ ...clienteValido, email: '' })
    const resultado = await editarCliente('cli-1', null, fd)
    expect(resultado).toEqual({ ok: true })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// excluirCliente
// ─────────────────────────────────────────────────────────────────────────────
describe('excluirCliente', () => {
  it('bloqueia exclusão quando há agendamentos ativos', async () => {
    mockDb.select.mockReturnValue(mkCountChain(2))
    const resultado = await excluirCliente('cli-1')
    expect(resultado.erro).toMatch(/2 agendamento/)
  })

  it('exclui cliente sem agendamentos ativos, apagando antes o histórico', async () => {
    mockDb.select.mockReturnValue(mkCountChain(0))
    mockDb.delete.mockReturnValue(mkDeleteChain())
    const resultado = await excluirCliente('cli-1')
    expect(resultado).toEqual({})
    // agendamentos.cliente_id é RESTRICT: o histórico precisa sair antes do cliente
    expect(mockDb.delete.mock.calls.map(([t]) => t)).toEqual([agendamentos, clientes])
  })

  it('retorna erro de DB na exclusão', async () => {
    mockDb.select.mockReturnValue(mkCountChain(0))
    mockDb.delete.mockReturnValue(mkDeleteChain(new Error('delete fail')))
    const resultado = await excluirCliente('cli-1')
    expect(resultado).toEqual({ erro: 'delete fail' })
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await excluirCliente('cli-1')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// editarMedium
// ─────────────────────────────────────────────────────────────────────────────
describe('editarMedium', () => {
  it('edita médium com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    const fd = makeFormData({ nome: 'Carlos Souza', especialidade: 'Passes', telefone: '' })
    const resultado = await editarMedium('med-1', null, fd)
    expect(resultado).toEqual({ ok: true })
  })

  it('retorna erro de validação para nome muito curto', async () => {
    const fd = makeFormData({ nome: 'X' })
    const resultado = await editarMedium('med-1', null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('retorna erro de DB', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('update fail')))
    const fd = makeFormData({ nome: 'Carlos Souza' })
    const resultado = await editarMedium('med-1', null, fd)
    expect(resultado?.erro).toBe('update fail')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// excluirMedium
// ─────────────────────────────────────────────────────────────────────────────
describe('excluirMedium', () => {
  it('desvincula agendamentos e exclui médium com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain()) // update medium_id = null
    mockDb.delete.mockReturnValue(mkDeleteChain()) // delete médium
    const resultado = await excluirMedium('med-1')
    expect(resultado).toEqual({})
  })

  it('retorna erro se exclusão do médium falhar', async () => {
    mockDb.update.mockReturnValue(mkUpdateChain())
    mockDb.delete.mockReturnValue(mkDeleteChain(new Error('delete fail')))
    const resultado = await excluirMedium('med-1')
    expect(resultado).toEqual({ erro: 'delete fail' })
  })

  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await excluirMedium('med-1')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist de emails ADMIN_EMAILS
// ─────────────────────────────────────────────────────────────────────────────
describe('verificarAdmin — whitelist de emails', () => {
  it('bloqueia usuário não listado no ADMIN_EMAILS', async () => {
    process.env.ADMIN_EMAILS = 'super@admin.com'
    mockAuth.mockResolvedValue(mkSessionClient({ email: 'outro@user.com', id: 'uid-2' }))
    const resultado = await excluirAgendamento('ag-1')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('permite usuário listado no ADMIN_EMAILS', async () => {
    process.env.ADMIN_EMAILS = 'super@admin.com,admin@test.com'
    mockAuth.mockResolvedValue(mkSessionClient({ email: 'admin@test.com', id: 'uid-admin' }))
    mockDb.delete.mockReturnValue(mkDeleteChain())
    const resultado = await excluirAgendamento('ag-1')
    expect(resultado).toEqual({})
  })
})
