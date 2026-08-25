import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@/lib/utils/recorrencia', () => ({
  expandirOcorrencias: vi.fn(),
}))

import { db } from '@/lib/db'
import { agendamentos, eventos } from '@/lib/db/schema'
import { expandirOcorrencias } from '@/lib/utils/recorrencia'
import { getContagensPorDia } from '@/lib/queries/calendario'

const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }
const mockExpandirOcorrencias = expandirOcorrencias as ReturnType<typeof vi.fn>

// ─── Helper ───────────────────────────────────────────────────────────────────
// Promise.all chama .from() em paralelo para cada tabela — cada uma resolve
// direto no .where() (sem passo adicional de orderBy).

type TableRef = typeof agendamentos | typeof eventos

function mkDb(config: { agendamentos?: unknown[]; eventos?: unknown[] }) {
  function mkChain(rows: unknown[]) {
    const chain = {
      where: vi.fn(() => Promise.resolve(rows)),
    }
    return chain
  }
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: TableRef) => {
        if (table === agendamentos) return mkChain(config.agendamentos ?? [])
        if (table === eventos) return mkChain(config.eventos ?? [])
        return mkChain([])
      }),
    })),
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
    mockDb.select.mockImplementation(mkDb({ agendamentos: [], eventos: [] }).select)
    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado).toEqual({})
  })

  it('conta agendamentos agrupados por dia', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        agendamentos: [
          { dataAgendada: '2025-04-10' },
          { dataAgendada: '2025-04-10' },
          { dataAgendada: '2025-04-15' },
        ],
        eventos: [],
      }).select
    )
    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado['2025-04-10']).toEqual({ agendamentos: 2, eventos: 0 })
    expect(resultado['2025-04-15']).toEqual({ agendamentos: 1, eventos: 0 })
  })

  it('conta eventos expandidos dentro do intervalo', async () => {
    const eventoSemanal = {
      dataInicio: '2025-04-07',
      recorrencia: 'semanal',
      dataFimRecorrencia: '2025-05-31',
    }
    mockDb.select.mockImplementation(
      mkDb({ agendamentos: [], eventos: [eventoSemanal] }).select
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
    mockDb.select.mockImplementation(
      mkDb({
        agendamentos: [],
        eventos: [{ dataInicio: '2025-03-01', recorrencia: 'semanal', dataFimRecorrencia: null }],
      }).select
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
    mockDb.select.mockImplementation(
      mkDb({
        agendamentos: [{ dataAgendada: '2025-04-10' }, { dataAgendada: '2025-04-10' }],
        eventos: [{ dataInicio: '2025-04-10', recorrencia: 'nenhuma', dataFimRecorrencia: null }],
      }).select
    )
    mockExpandirOcorrencias.mockReturnValue(['2025-04-10'])

    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    expect(resultado['2025-04-10']).toEqual({ agendamentos: 2, eventos: 1 })
  })

  it('trata múltiplos eventos com ocorrências sobrepostas', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        agendamentos: [],
        eventos: [
          { dataInicio: '2025-04-10', recorrencia: 'nenhuma', dataFimRecorrencia: null },
          { dataInicio: '2025-04-10', recorrencia: 'nenhuma', dataFimRecorrencia: null },
        ],
      }).select
    )
    mockExpandirOcorrencias.mockReturnValue(['2025-04-10'])

    const resultado = await getContagensPorDia('2025-04-01', '2025-04-30')
    // Dois eventos no mesmo dia → eventos: 2
    expect(resultado['2025-04-10']?.eventos).toBe(2)
  })

  it('lida corretamente com intervalo de dois meses', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        agendamentos: [{ dataAgendada: '2025-04-05' }, { dataAgendada: '2025-05-12' }],
        eventos: [],
      }).select
    )
    const resultado = await getContagensPorDia('2025-04-01', '2025-05-31')
    expect(resultado['2025-04-05']).toEqual({ agendamentos: 1, eventos: 0 })
    expect(resultado['2025-05-12']).toEqual({ agendamentos: 1, eventos: 0 })
    expect(Object.keys(resultado)).toHaveLength(2)
  })
})
