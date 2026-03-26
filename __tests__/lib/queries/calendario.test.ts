import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/utils/recorrencia', () => ({
  expandirOcorrencias: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'
import { expandirOcorrencias } from '@/lib/utils/recorrencia'
import { getContagensPorDia } from '@/lib/queries/calendario'

const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>
const mockExpandirOcorrencias = expandirOcorrencias as ReturnType<typeof vi.fn>

// ─── Helper ───────────────────────────────────────────────────────────────────

type TableResp = { data: unknown; error?: unknown }

/**
 * Mock que suporta Promise.all — cada tabela pode ter response independente.
 * Promise.all chama from() em paralelo para cada query.
 */
function mkClient(tableResponses: Record<string, TableResp>) {
  return {
    from: vi.fn((tabela: string) => {
      const resp = tableResponses[tabela] ?? { data: [], error: null }
      const chain: Record<string, unknown> = {
        then: (res: (v: unknown) => unknown) => Promise.resolve(resp).then(res),
        catch: (rej: (e: unknown) => unknown) => Promise.resolve(resp).catch(rej),
        finally: (f: () => void) => Promise.resolve(resp).finally(f),
        [Symbol.toStringTag]: 'Promise',
      }
      ;['select', 'eq', 'gte', 'lte', 'neq', 'order'].forEach((m) => {
        chain[m] = vi.fn().mockReturnValue(chain)
      })
      return chain
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockExpandirOcorrencias.mockReturnValue([]) // padrão: sem ocorrências
})

// ─────────────────────────────────────────────────────────────────────────────
// getContagensPorDia
// ─────────────────────────────────────────────────────────────────────────────
describe('getContagensPorDia', () => {
  it('retorna objeto vazio quando não há agendamentos nem eventos', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: { data: [] },
        eventos: { data: [] },
      })
    )
    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado).toEqual({})
  })

  it('conta agendamentos agrupados por dia', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: {
          data: [
            { data_agendada: '2025-04-10' },
            { data_agendada: '2025-04-10' },
            { data_agendada: '2025-04-15' },
          ],
        },
        eventos: { data: [] },
      })
    )
    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado['2025-04-10']).toEqual({ agendamentos: 2, eventos: 0 })
    expect(resultado['2025-04-15']).toEqual({ agendamentos: 1, eventos: 0 })
  })

  it('conta eventos expandidos dentro do intervalo', async () => {
    const eventoSemanal = {
      data_inicio: '2025-04-07',
      recorrencia: 'semanal',
      data_fim_recorrencia: '2025-05-31',
    }
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: { data: [] },
        eventos: { data: [eventoSemanal] },
      })
    )
    mockExpandirOcorrencias.mockReturnValue([
      '2025-04-07',
      '2025-04-14',
      '2025-04-21',
      '2025-04-28',
    ])

    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado['2025-04-07']).toEqual({ agendamentos: 0, eventos: 1 })
    expect(resultado['2025-04-14']).toEqual({ agendamentos: 0, eventos: 1 })
    expect(resultado['2025-04-21']).toEqual({ agendamentos: 0, eventos: 1 })
    expect(resultado['2025-04-28']).toEqual({ agendamentos: 0, eventos: 1 })
  })

  it('filtra ocorrências de eventos fora do intervalo', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: { data: [] },
        eventos: {
          data: [{ data_inicio: '2025-03-01', recorrencia: 'semanal', data_fim_recorrencia: null }],
        },
      })
    )
    // expandirOcorrencias retorna datas fora do intervalo solicitado
    mockExpandirOcorrencias.mockReturnValue([
      '2025-03-01', // antes do intervalo
      '2025-05-01', // depois do intervalo
    ])

    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(Object.keys(resultado)).toHaveLength(0)
  })

  it('combina agendamentos e eventos no mesmo dia', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: {
          data: [
            { data_agendada: '2025-04-10' },
            { data_agendada: '2025-04-10' },
          ],
        },
        eventos: {
          data: [{ data_inicio: '2025-04-10', recorrencia: 'nenhuma', data_fim_recorrencia: null }],
        },
      })
    )
    mockExpandirOcorrencias.mockReturnValue(['2025-04-10'])

    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado['2025-04-10']).toEqual({ agendamentos: 2, eventos: 1 })
  })

  it('trata múltiplos eventos com ocorrências sobrepostas', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: { data: [] },
        eventos: {
          data: [
            { data_inicio: '2025-04-10', recorrencia: 'nenhuma', data_fim_recorrencia: null },
            { data_inicio: '2025-04-10', recorrencia: 'nenhuma', data_fim_recorrencia: null },
          ],
        },
      })
    )
    mockExpandirOcorrencias.mockReturnValue(['2025-04-10'])

    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    // Dois eventos no mesmo dia → eventos: 2
    expect(resultado['2025-04-10']?.eventos).toBe(2)
  })

  it('retorna objeto vazio quando agendamentos é null (DB error)', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: { data: null },
        eventos: { data: null },
      })
    )
    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado).toEqual({})
  })

  it('lida corretamente com intervalo de dois meses', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        agendamentos: {
          data: [
            { data_agendada: '2025-04-05' },
            { data_agendada: '2025-05-12' },
          ],
        },
        eventos: { data: [] },
      })
    )
    const resultado = await getContagensPorDia('2025-04-01', '2025-05-31')
    expect(resultado['2025-04-05']).toEqual({ agendamentos: 1, eventos: 0 })
    expect(resultado['2025-05-12']).toEqual({ agendamentos: 1, eventos: 0 })
    expect(Object.keys(resultado)).toHaveLength(2)
  })
})
