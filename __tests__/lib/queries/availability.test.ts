import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock do createAdminClient (Supabase) ─────────────────────────
// Precisamos simular o builder fluente de queries do Supabase.
// Cada chamada de .from() retorna um builder com métodos encadeáveis.

function buildSupabaseMock(responses: Record<string, { data: unknown; error?: unknown }>) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    // resolve final
    _resolve: null as unknown,
  }

  const from = vi.fn((tabela: string) => {
    const resp = responses[tabela] ?? { data: [], error: null }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation(function () {
        return Promise.resolve(resp)
      }),
      // Promise implícita — para queries sem .order()
      then: (resolve: (v: unknown) => void) => resolve(resp),
      [Symbol.toStringTag]: 'Promise',
    }
  })

  return { from }
}

// Helper mais preciso: cria mock que resolve como Promise
function mkClient(tableResponses: Record<string, { data: unknown; error?: unknown }>) {
  const client = {
    from: vi.fn().mockImplementation((tabela: string) => {
      const resp = tableResponses[tabela] ?? { data: [], error: null }
      const q: Record<string, unknown> = {}
      const chainable = () => q
      ;['select', 'eq', 'in', 'is', 'gte', 'order'].forEach((m) => {
        q[m] = vi.fn().mockImplementation(() => {
          // Cada método retorna o mesmo objeto (encadeável e resolvível)
          return chainablePromise
        })
      })
      const chainablePromise: unknown = {
        ...q,
        then: (res: (v: unknown) => void) => Promise.resolve(resp).then(res),
        catch: (rej: (e: unknown) => void) => Promise.resolve(resp).catch(rej),
        finally: (f: () => void) => Promise.resolve(resp).finally(f),
        [Symbol.toStringTag]: 'Promise',
      }
      return chainablePromise
    }),
  }
  return client
}

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'
import {
  getSlotsDisponiveis,
  getDatasBlockeadas,
  getDiasAtivos,
} from '@/lib/queries/availability'

const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Fixtures ─────────────────────────────────────────────────────
const GRADE_TERCA = [
  { dia_semana: 2, hora_inicio: '09:00:00', hora_fim: '10:00:00', ativo: true },
  { dia_semana: 2, hora_inicio: '10:00:00', hora_fim: '11:00:00', ativo: true },
  { dia_semana: 2, hora_inicio: '14:00:00', hora_fim: '15:00:00', ativo: true },
]

// ─────────────────────────────────────────────────────────────────
// getSlotsDisponiveis
// ─────────────────────────────────────────────────────────────────
describe('getSlotsDisponiveis', () => {
  it('retorna slots normalizados para HH:MM quando não há conflitos', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: { data: GRADE_TERCA },
        datas_bloqueadas: { data: [] },
        agendamentos: { data: [] },
      })
    )

    const resultado = await getSlotsDisponiveis('2025-03-25') // terça-feira
    expect(resultado.erro).toBeUndefined()
    expect(resultado.slots).toHaveLength(3)
    // Verifica que HH:MM:SS foi normalizado para HH:MM
    expect(resultado.slots[0].hora_inicio).toBe('09:00')
    expect(resultado.slots[0].hora_fim).toBe('10:00')
  })

  it('retorna [] quando não há grade para o dia', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: { data: [] },
        datas_bloqueadas: { data: [] },
        agendamentos: { data: [] },
      })
    )

    const resultado = await getSlotsDisponiveis('2025-03-23') // domingo sem grade
    expect(resultado.slots).toHaveLength(0)
    expect(resultado.erro).toBeUndefined()
  })

  it('retorna [] quando o dia inteiro está bloqueado (hora_inicio null)', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: { data: GRADE_TERCA },
        datas_bloqueadas: { data: [{ data_bloqueada: '2025-03-25', hora_inicio: null }] },
        agendamentos: { data: [] },
      })
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(0)
  })

  it('exclui slots com bloqueio parcial de hora', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: { data: GRADE_TERCA },
        datas_bloqueadas: {
          data: [{ data_bloqueada: '2025-03-25', hora_inicio: '09:00:00' }],
        },
        agendamentos: { data: [] },
      })
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(2)
    expect(resultado.slots.find((s) => s.hora_inicio === '09:00')).toBeUndefined()
  })

  it('exclui slots já agendados (pendente/confirmado)', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: { data: GRADE_TERCA },
        datas_bloqueadas: { data: [] },
        agendamentos: { data: [{ hora_inicio: '10:00:00' }] },
      })
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(2)
    expect(resultado.slots.find((s) => s.hora_inicio === '10:00')).toBeUndefined()
  })

  it('exclui múltiplos slots ocupados e bloqueados simultaneamente', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: { data: GRADE_TERCA },
        datas_bloqueadas: {
          data: [{ data_bloqueada: '2025-03-25', hora_inicio: '09:00:00' }],
        },
        agendamentos: { data: [{ hora_inicio: '10:00:00' }] },
      })
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(1)
    expect(resultado.slots[0].hora_inicio).toBe('14:00')
  })

  it('propaga erro da query de grade_horarios', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: { data: null, error: { message: 'DB connection failed' } },
        datas_bloqueadas: { data: [] },
        agendamentos: { data: [] },
      })
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(0)
    expect(resultado.erro).toBe('DB connection failed')
  })
})

// ─────────────────────────────────────────────────────────────────
// getDatasBlockeadas
// ─────────────────────────────────────────────────────────────────
describe('getDatasBlockeadas', () => {
  it('retorna lista de strings de datas bloqueadas', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        datas_bloqueadas: {
          data: [
            { data_bloqueada: '2025-04-01' },
            { data_bloqueada: '2025-04-15' },
          ],
        },
      })
    )

    const datas = await getDatasBlockeadas()
    expect(datas).toEqual(['2025-04-01', '2025-04-15'])
  })

  it('retorna [] quando não há bloqueios', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        datas_bloqueadas: { data: [] },
      })
    )

    const datas = await getDatasBlockeadas()
    expect(datas).toEqual([])
  })

  it('retorna [] em caso de erro (sem lançar exceção)', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        datas_bloqueadas: { data: null, error: { message: 'DB error' } },
      })
    )

    const datas = await getDatasBlockeadas()
    expect(datas).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────
// getDiasAtivos
// ─────────────────────────────────────────────────────────────────
describe('getDiasAtivos', () => {
  it('retorna dias únicos da grade ativa', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        grade_horarios: {
          data: [
            { dia_semana: 2 },
            { dia_semana: 2 }, // duplicado
            { dia_semana: 3 },
            { dia_semana: 5 },
            { dia_semana: 6 },
          ],
        },
      })
    )

    const dias = await getDiasAtivos()
    expect(dias).toEqual([2, 3, 5, 6])
    expect(dias).toHaveLength(4) // sem duplicatas
  })

  it('retorna [] quando não há grade ativa', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({ grade_horarios: { data: [] } })
    )

    const dias = await getDiasAtivos()
    expect(dias).toEqual([])
  })
})
