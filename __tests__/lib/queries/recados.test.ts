import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn() },
}))

import { db } from '@/lib/db'
import { listarRecados } from '@/lib/queries/recados'

const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }

function mkDb(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(rows)),
        })),
      })),
    })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Formato "bruto" retornado pelo Drizzle: timestamps como Date, não string.

const RECADO_NORMAL = {
  id: 'rec-1',
  titulo: 'Informação geral',
  conteudo: 'Texto do recado',
  prioridade: 'normal' as const,
  fixado: false,
  ativo: true,
  criadoEm: new Date('2025-04-01T10:00:00Z'),
  atualizadoEm: new Date('2025-04-01T10:00:00Z'),
}

const RECADO_URGENTE_FIXADO = {
  id: 'rec-2',
  titulo: 'ATENÇÃO',
  conteudo: 'Sessão especial',
  prioridade: 'urgente' as const,
  fixado: true,
  ativo: true,
  criadoEm: new Date('2025-04-02T08:00:00Z'),
  atualizadoEm: new Date('2025-04-02T08:00:00Z'),
}

// ─────────────────────────────────────────────────────────────────────────────
// listarRecados
// ─────────────────────────────────────────────────────────────────────────────
describe('listarRecados', () => {
  it('retorna lista de recados ativos', async () => {
    mockDb.select.mockImplementation(mkDb([RECADO_URGENTE_FIXADO, RECADO_NORMAL]).select)
    const resultado = await listarRecados()
    expect(resultado).toHaveLength(2)
    expect(resultado[0].id).toBe('rec-2')
    expect(resultado[1].id).toBe('rec-1')
  })

  it('retorna array vazio quando não há recados ativos', async () => {
    mockDb.select.mockImplementation(mkDb([]).select)
    const resultado = await listarRecados()
    expect(resultado).toEqual([])
  })

  it('retorna recados com todas as propriedades corretas', async () => {
    mockDb.select.mockImplementation(mkDb([RECADO_URGENTE_FIXADO]).select)
    const [recado] = await listarRecados()
    expect(recado.id).toBe('rec-2')
    expect(recado.titulo).toBe('ATENÇÃO')
    expect(recado.prioridade).toBe('urgente')
    expect(recado.fixado).toBe(true)
    expect(recado.ativo).toBe(true)
    expect(recado.criado_em).toBe('2025-04-02T08:00:00.000Z')
  })

  it('preserva a ordem dos recados retornados pelo banco (fixado DESC, criado_em DESC)', async () => {
    // O banco aplica ORDER BY fixado DESC, criado_em DESC
    // O mock retorna dados já nessa ordem; listarRecados não reordena no JS
    mockDb.select.mockImplementation(mkDb([RECADO_URGENTE_FIXADO, RECADO_NORMAL]).select)
    const resultado = await listarRecados()
    expect(resultado[0].fixado).toBe(true) // fixado primeiro
    expect(resultado[1].fixado).toBe(false)
  })

  it('retorna recados com prioridade "importante"', async () => {
    const recadoImportante = { ...RECADO_NORMAL, id: 'rec-3', prioridade: 'importante' as const }
    mockDb.select.mockImplementation(mkDb([recadoImportante]).select)
    const resultado = await listarRecados()
    expect(resultado[0].prioridade).toBe('importante')
  })
})
