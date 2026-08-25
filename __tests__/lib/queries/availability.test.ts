import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}))

import { db } from '@/lib/db'
import { gradeHorarios, datasBloqueadas, agendamentos } from '@/lib/db/schema'
import {
  getSlotsDisponiveis,
  getDatasBlockeadas,
  getDiasAtivos,
} from '@/lib/queries/availability'

const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }

// ─── Mock do client Drizzle ─────────────────────────────────────────
// db.select().from(tabela).where(...) é "thenable" direto (resolve pros
// rows); .orderBy(...) encadeia mais um passo. Uma tabela pode ser
// configurada pra rejeitar (simula erro de DB).

type TableRef = typeof gradeHorarios | typeof datasBloqueadas | typeof agendamentos

function mkDb(config: {
  gradeHorarios?: unknown[]
  datasBloqueadas?: unknown[]
  agendamentos?: unknown[]
  erros?: { gradeHorarios?: string }
}) {
  function mkChain(rows: unknown[]) {
    const chain = {
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => Promise.resolve(rows)),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(res, rej),
      catch: (rej: (e: unknown) => unknown) => Promise.resolve(rows).catch(rej),
    }
    return chain
  }

  function mkErrorChain(message: string) {
    const erro = new Error(message)
    const chain = {
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => Promise.reject(erro)),
      then: (_res: unknown, rej?: (e: unknown) => unknown) => Promise.reject(erro).catch(rej),
      catch: (rej: (e: unknown) => unknown) => Promise.reject(erro).catch(rej),
    }
    return chain
  }

  return {
    select: vi.fn(() => ({
      from: vi.fn((table: TableRef) => {
        if (table === gradeHorarios) {
          if (config.erros?.gradeHorarios) return mkErrorChain(config.erros.gradeHorarios)
          return mkChain(config.gradeHorarios ?? [])
        }
        if (table === datasBloqueadas) return mkChain(config.datasBloqueadas ?? [])
        if (table === agendamentos) return mkChain(config.agendamentos ?? [])
        return mkChain([])
      }),
    })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Fixtures ─────────────────────────────────────────────────────
const GRADE_TERCA = [
  { diaSemana: 2, horaInicio: '09:00:00', horaFim: '10:00:00', ativo: true },
  { diaSemana: 2, horaInicio: '10:00:00', horaFim: '11:00:00', ativo: true },
  { diaSemana: 2, horaInicio: '14:00:00', horaFim: '15:00:00', ativo: true },
]

// ─────────────────────────────────────────────────────────────────
// getSlotsDisponiveis
// ─────────────────────────────────────────────────────────────────
describe('getSlotsDisponiveis', () => {
  it('retorna slots normalizados para HH:MM quando não há conflitos', async () => {
    mockDb.select.mockImplementation(
      mkDb({ gradeHorarios: GRADE_TERCA, datasBloqueadas: [], agendamentos: [] }).select
    )

    const resultado = await getSlotsDisponiveis('2025-03-25') // terça-feira
    expect(resultado.erro).toBeUndefined()
    expect(resultado.slots).toHaveLength(3)
    // Verifica que HH:MM:SS foi normalizado para HH:MM
    expect(resultado.slots[0].hora_inicio).toBe('09:00')
    expect(resultado.slots[0].hora_fim).toBe('10:00')
  })

  it('retorna [] quando não há grade para o dia', async () => {
    mockDb.select.mockImplementation(
      mkDb({ gradeHorarios: [], datasBloqueadas: [], agendamentos: [] }).select
    )

    const resultado = await getSlotsDisponiveis('2025-03-23') // domingo sem grade
    expect(resultado.slots).toHaveLength(0)
    expect(resultado.erro).toBeUndefined()
  })

  it('retorna [] quando o dia inteiro está bloqueado (hora_inicio null)', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        gradeHorarios: GRADE_TERCA,
        datasBloqueadas: [{ dataBloqueada: '2025-03-25', horaInicio: null }],
        agendamentos: [],
      }).select
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(0)
  })

  it('exclui slots com bloqueio parcial de hora', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        gradeHorarios: GRADE_TERCA,
        datasBloqueadas: [{ dataBloqueada: '2025-03-25', horaInicio: '09:00:00' }],
        agendamentos: [],
      }).select
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(2)
    expect(resultado.slots.find((s) => s.hora_inicio === '09:00')).toBeUndefined()
  })

  it('exclui slots já agendados (pendente/confirmado)', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        gradeHorarios: GRADE_TERCA,
        datasBloqueadas: [],
        agendamentos: [{ horaInicio: '10:00:00' }],
      }).select
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(2)
    expect(resultado.slots.find((s) => s.hora_inicio === '10:00')).toBeUndefined()
  })

  it('exclui múltiplos slots ocupados e bloqueados simultaneamente', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        gradeHorarios: GRADE_TERCA,
        datasBloqueadas: [{ dataBloqueada: '2025-03-25', horaInicio: '09:00:00' }],
        agendamentos: [{ horaInicio: '10:00:00' }],
      }).select
    )

    const resultado = await getSlotsDisponiveis('2025-03-25')
    expect(resultado.slots).toHaveLength(1)
    expect(resultado.slots[0].hora_inicio).toBe('14:00')
  })

  it('propaga erro da query de grade_horarios', async () => {
    mockDb.select.mockImplementation(
      mkDb({ erros: { gradeHorarios: 'DB connection failed' } }).select
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
    mockDb.select.mockImplementation(
      mkDb({
        datasBloqueadas: [{ dataBloqueada: '2025-04-01' }, { dataBloqueada: '2025-04-15' }],
      }).select
    )

    const datas = await getDatasBlockeadas()
    expect(datas).toEqual(['2025-04-01', '2025-04-15'])
  })

  it('retorna [] quando não há bloqueios', async () => {
    mockDb.select.mockImplementation(mkDb({ datasBloqueadas: [] }).select)

    const datas = await getDatasBlockeadas()
    expect(datas).toEqual([])
  })

  it('retorna [] em caso de erro (sem lançar exceção)', async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error('DB error')
    })

    const datas = await getDatasBlockeadas()
    expect(datas).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────
// getDiasAtivos
// ─────────────────────────────────────────────────────────────────
describe('getDiasAtivos', () => {
  it('retorna dias únicos da grade ativa', async () => {
    mockDb.select.mockImplementation(
      mkDb({
        gradeHorarios: [
          { diaSemana: 2 },
          { diaSemana: 2 }, // duplicado
          { diaSemana: 3 },
          { diaSemana: 5 },
          { diaSemana: 6 },
        ],
      }).select
    )

    const dias = await getDiasAtivos()
    expect(dias).toEqual([2, 3, 5, 6])
    expect(dias).toHaveLength(4) // sem duplicatas
  })

  it('retorna [] quando não há grade ativa', async () => {
    mockDb.select.mockImplementation(mkDb({ gradeHorarios: [] }).select)

    const dias = await getDiasAtivos()
    expect(dias).toEqual([])
  })
})
