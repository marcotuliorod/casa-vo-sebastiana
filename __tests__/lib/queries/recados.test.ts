import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from '@/lib/supabase/server'
import { listarRecados } from '@/lib/queries/recados'

const mockCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>

// ─── Helper ───────────────────────────────────────────────────────────────────

function mkClient(tableResponses: Record<string, { data: unknown; error?: unknown }>) {
  return {
    from: vi.fn((tabela: string) => {
      const resp = tableResponses[tabela] ?? { data: [], error: null }
      const chain: Record<string, unknown> = {
        then: (res: (v: unknown) => unknown) => Promise.resolve(resp).then(res),
        catch: (rej: (e: unknown) => unknown) => Promise.resolve(resp).catch(rej),
        finally: (f: () => void) => Promise.resolve(resp).finally(f),
        [Symbol.toStringTag]: 'Promise',
      }
      ;['select', 'eq', 'order'].forEach((m) => {
        chain[m] = vi.fn().mockReturnValue(chain)
      })
      return chain
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RECADO_NORMAL = {
  id: 'rec-1',
  titulo: 'Informação geral',
  conteudo: 'Texto do recado',
  prioridade: 'normal' as const,
  fixado: false,
  ativo: true,
  criado_em: '2025-04-01T10:00:00Z',
  atualizado_em: '2025-04-01T10:00:00Z',
}

const RECADO_URGENTE_FIXADO = {
  id: 'rec-2',
  titulo: 'ATENÇÃO',
  conteudo: 'Sessão especial',
  prioridade: 'urgente' as const,
  fixado: true,
  ativo: true,
  criado_em: '2025-04-02T08:00:00Z',
  atualizado_em: '2025-04-02T08:00:00Z',
}

// ─────────────────────────────────────────────────────────────────────────────
// listarRecados
// ─────────────────────────────────────────────────────────────────────────────
describe('listarRecados', () => {
  it('retorna lista de recados ativos', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({
        recados: { data: [RECADO_URGENTE_FIXADO, RECADO_NORMAL] },
      })
    )
    const resultado = await listarRecados()
    expect(resultado).toHaveLength(2)
    expect(resultado[0].id).toBe('rec-2')
    expect(resultado[1].id).toBe('rec-1')
  })

  it('retorna array vazio quando não há recados ativos', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({ recados: { data: [] } })
    )
    const resultado = await listarRecados()
    expect(resultado).toEqual([])
  })

  it('retorna array vazio quando data é null (erro de DB)', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({ recados: { data: null } })
    )
    const resultado = await listarRecados()
    expect(resultado).toEqual([])
  })

  it('retorna recados com todas as propriedades corretas', async () => {
    mockCreateAdminClient.mockReturnValue(
      mkClient({ recados: { data: [RECADO_URGENTE_FIXADO] } })
    )
    const [recado] = await listarRecados()
    expect(recado.id).toBe('rec-2')
    expect(recado.titulo).toBe('ATENÇÃO')
    expect(recado.prioridade).toBe('urgente')
    expect(recado.fixado).toBe(true)
    expect(recado.ativo).toBe(true)
    expect(recado.criado_em).toBe('2025-04-02T08:00:00Z')
  })

  it('preserva a ordem dos recados retornados pelo banco (fixado DESC, criado_em DESC)', async () => {
    // O banco aplica ORDER BY fixado DESC, criado_em DESC
    // O mock retorna dados já nessa ordem; listarRecados não reordena no JS
    const dados = [RECADO_URGENTE_FIXADO, RECADO_NORMAL]
    mockCreateAdminClient.mockReturnValue(
      mkClient({ recados: { data: dados } })
    )
    const resultado = await listarRecados()
    expect(resultado[0].fixado).toBe(true)  // fixado primeiro
    expect(resultado[1].fixado).toBe(false)
  })

  it('retorna recados com prioridade "importante"', async () => {
    const recadoImportante = { ...RECADO_NORMAL, id: 'rec-3', prioridade: 'importante' as const }
    mockCreateAdminClient.mockReturnValue(
      mkClient({ recados: { data: [recadoImportante] } })
    )
    const resultado = await listarRecados()
    expect(resultado[0].prioridade).toBe('importante')
  })
})
