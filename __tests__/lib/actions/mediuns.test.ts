import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'
import { assumirAgendamento, liberarAgendamento } from '@/lib/actions/mediuns'

const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TableResp = { data?: unknown; error?: { message: string } | null }

function mkDbClient(tableResponses: Record<string, TableResp | TableResp[]>) {
  const callCounts: Record<string, number> = {}

  function mkChain(resp: TableResp): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(resp).then(res, rej),
      catch: (rej: (e: unknown) => unknown) => Promise.resolve(resp).catch(rej),
      finally: (f: () => void) => Promise.resolve(resp).finally(f),
      [Symbol.toStringTag]: 'Promise',
    }
    ;['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'single'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain)
    })
    return chain
  }

  return {
    from: vi.fn((tabela: string) => {
      const raw = tableResponses[tabela]
      const idx = callCounts[tabela] ?? 0
      callCounts[tabela] = idx + 1
      const resp: TableResp = Array.isArray(raw)
        ? (raw[idx] ?? raw[raw.length - 1])
        : (raw ?? { data: null, error: null })
      return mkChain(resp)
    }),
  }
}

const MEDIUM_VALIDO = { id: 'med-1' }
const AG_SEM_MEDIUM = { id: 'ag-1', medium_id: null }
const AG_COM_MEDIUM = { id: 'ag-1', medium_id: 'med-outro' }

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// assumirAgendamento
// ─────────────────────────────────────────────────────────────────────────────
describe('assumirAgendamento', () => {
  it('retorna erro para token inválido (médium não encontrado)', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: null, error: { message: 'not found' } },
      })
    )
    const resultado = await assumirAgendamento('ag-1', 'token-invalido')
    expect(resultado).toEqual({ erro: 'Token inválido.' })
  })

  it('retorna erro para token de médium inativo', async () => {
    // Supabase retorna erro/null quando .eq('ativo', true) não encontra resultado
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: null, error: { message: 'row not found' } },
      })
    )
    const resultado = await assumirAgendamento('ag-1', 'token-inativo')
    expect(resultado).toEqual({ erro: 'Token inválido.' })
  })

  it('retorna erro para agendamento inexistente', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: MEDIUM_VALIDO, error: null },
        agendamentos: { data: null, error: { message: 'not found' } },
      })
    )
    const resultado = await assumirAgendamento('ag-inexistente', 'token-valido')
    expect(resultado).toEqual({ erro: 'Agendamento não encontrado.' })
  })

  it('retorna erro quando agendamento já foi assumido por outro médium', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: MEDIUM_VALIDO, error: null },
        agendamentos: { data: AG_COM_MEDIUM, error: null },
      })
    )
    const resultado = await assumirAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({ erro: 'Este agendamento já foi assumido por outro médium.' })
  })

  it('assume agendamento disponível com sucesso', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: MEDIUM_VALIDO, error: null },
        agendamentos: [
          { data: AG_SEM_MEDIUM, error: null }, // select
          { data: null, error: null },           // update
        ],
      })
    )
    const resultado = await assumirAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB na atualização', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: MEDIUM_VALIDO, error: null },
        agendamentos: [
          { data: AG_SEM_MEDIUM, error: null },
          { data: null, error: { message: 'update fail' } },
        ],
      })
    )
    const resultado = await assumirAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({ erro: 'update fail' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// liberarAgendamento
// ─────────────────────────────────────────────────────────────────────────────
describe('liberarAgendamento', () => {
  it('retorna erro para token inválido', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: null, error: { message: 'not found' } },
      })
    )
    const resultado = await liberarAgendamento('ag-1', 'token-invalido')
    expect(resultado).toEqual({ erro: 'Token inválido.' })
  })

  it('libera agendamento do próprio médium com sucesso', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: MEDIUM_VALIDO, error: null },
        agendamentos: { data: null, error: null },
      })
    )
    const resultado = await liberarAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({})
  })

  it('retorna erro de DB ao liberar', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: MEDIUM_VALIDO, error: null },
        agendamentos: { data: null, error: { message: 'update fail' } },
      })
    )
    const resultado = await liberarAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({ erro: 'update fail' })
  })

  it('não libera agendamento de outro médium (update com eq medium_id não afeta)', async () => {
    // O UPDATE tem .eq('medium_id', medium.id), então se o agendamento
    // pertencer a outro médium, a query não retorna erro — mas nenhuma
    // linha é afetada. O comportamento atual retorna {} (sem erro).
    // Este teste documenta esse comportamento.
    mockCreateAdminClient.mockReturnValue(
      mkDbClient({
        mediuns: { data: MEDIUM_VALIDO, error: null },
        agendamentos: { data: null, error: null }, // zero rows affected, sem erro
      })
    )
    const resultado = await liberarAgendamento('ag-1', 'token-valido')
    expect(resultado).toEqual({})
  })
})
