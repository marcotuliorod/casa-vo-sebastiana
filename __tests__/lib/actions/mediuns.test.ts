import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}))

import { db } from '@/lib/db'
import { assumirAgendamento, liberarAgendamento } from '@/lib/actions/mediuns'

const mockDb = db as unknown as { select: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

// ─── Helpers ──────────────────────────────────────────────────────────────────
// db.select({...}).from(table).where(cond).limit(n) — thenable a cada passo,
// resolve para a lista de linhas configurada (ou lança, simulando erro de DB).

function mkSelectChain(resultado: unknown[] | Error) {
  const chain = {
    where: vi.fn(() => chain),
    limit: vi.fn(() =>
      resultado instanceof Error ? Promise.reject(resultado) : Promise.resolve(resultado)
    ),
  }
  return chain
}

function mkUpdateChain(erro?: Error) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => (erro ? Promise.reject(erro) : Promise.resolve([]))),
    })),
  }
}

const MEDIUM_VALIDO = { id: 'med-1' }
const AG_SEM_MEDIUM = { id: 'ag-1', mediumId: null }
const AG_COM_MEDIUM = { id: 'ag-1', mediumId: 'med-outro' }

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// assumirAgendamento
// ─────────────────────────────────────────────────────────────────────────────
describe('assumirAgendamento', () => {
  it('retorna erro para token inválido (médium não encontrado)', async () => {
    mockDb.select.mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([])) })
    const resultado = await assumirAgendamento('ag-1', 'token-invalido')
    expect(resultado).toEqual({ erro: 'Token inválido.' })
  })

  it('retorna erro para agendamento inexistente', async () => {
    mockDb.select
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([MEDIUM_VALIDO])) })
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([])) })
    const resultado = await assumirAgendamento('ag-inexistente', 'token-valido')
    expect(resultado).toEqual({ erro: 'Agendamento não encontrado.' })
  })

  it('retorna erro quando agendamento já foi assumido por outro médium', async () => {
    mockDb.select
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([MEDIUM_VALIDO])) })
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([AG_COM_MEDIUM])) })
    const resultado = await assumirAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({ erro: 'Este agendamento já foi assumido por outro médium.' })
  })

  it('assume agendamento disponível com sucesso', async () => {
    mockDb.select
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([MEDIUM_VALIDO])) })
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([AG_SEM_MEDIUM])) })
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await assumirAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB na atualização', async () => {
    mockDb.select
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([MEDIUM_VALIDO])) })
      .mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([AG_SEM_MEDIUM])) })
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('update fail')))
    const resultado = await assumirAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({ erro: 'update fail' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// liberarAgendamento
// ─────────────────────────────────────────────────────────────────────────────
describe('liberarAgendamento', () => {
  it('retorna erro para token inválido', async () => {
    mockDb.select.mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([])) })
    const resultado = await liberarAgendamento('ag-1', 'token-invalido')
    expect(resultado).toEqual({ erro: 'Token inválido.' })
  })

  it('libera agendamento do próprio médium com sucesso', async () => {
    mockDb.select.mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([MEDIUM_VALIDO])) })
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await liberarAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB ao liberar', async () => {
    mockDb.select.mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([MEDIUM_VALIDO])) })
    mockDb.update.mockReturnValue(mkUpdateChain(new Error('update fail')))
    const resultado = await liberarAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({ erro: 'update fail' })
  })

  it('não libera agendamento de outro médium (where com medium_id filtra, zero linhas afetadas)', async () => {
    // O UPDATE tem where(agendamentoId, mediumId), então se o agendamento
    // pertencer a outro médium a query não afeta nenhuma linha — mas também
    // não lança erro. O comportamento atual retorna {} (sem erro). Este
    // teste documenta esse comportamento.
    mockDb.select.mockReturnValueOnce({ from: vi.fn(() => mkSelectChain([MEDIUM_VALIDO])) })
    mockDb.update.mockReturnValue(mkUpdateChain())
    const resultado = await liberarAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({})
  })
})
