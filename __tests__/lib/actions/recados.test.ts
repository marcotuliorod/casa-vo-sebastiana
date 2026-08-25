import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}))

import { db } from '@/lib/db'
import { auth } from '@/lib/auth/config'
import {
  criarRecado,
  editarRecado,
  excluirRecado,
  toggleFixadoRecado,
} from '@/lib/actions/recados'

const mockDb = db as unknown as { insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
const mockAuth = auth as ReturnType<typeof vi.fn>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkInsertOk() {
  return { values: vi.fn(() => Promise.resolve([])) }
}
function mkInsertErr(message: string) {
  return { values: vi.fn(() => Promise.reject(new Error(message))) }
}
function mkUpdateOk() {
  return { set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) }
}
function mkUpdateErr(message: string) {
  return { set: vi.fn(() => ({ where: vi.fn(() => Promise.reject(new Error(message))) })) }
}

function mkSessionClient(user: { email: string; id: string } | null) {
  return user ? { user, expires: '2099-01-01T00:00:00.000Z' } : null
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  // Remover ADMIN_EMAILS para permitir qualquer usuário autenticado
  // (recados.ts não usa .filter(Boolean) então '' criaria [''] bloqueando tudo)
  delete process.env.ADMIN_EMAILS
  mockAuth.mockResolvedValue(
    mkSessionClient({ email: 'admin@test.com', id: 'uid-admin' })
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// criarRecado
// ─────────────────────────────────────────────────────────────────────────────
describe('criarRecado', () => {
  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const fd = makeFormData({ titulo: 'Aviso', conteudo: 'Reunião cancelada' })
    const resultado = await criarRecado(null, fd)
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('retorna erro de validação para título muito curto', async () => {
    const fd = makeFormData({ titulo: 'A', conteudo: 'Conteúdo válido' })
    const resultado = await criarRecado(null, fd)
    expect(resultado?.erro).toBeDefined()
    expect(resultado?.campo).toBe('titulo')
  })

  it('retorna erro de validação para conteúdo vazio', async () => {
    const fd = makeFormData({ titulo: 'Aviso Importante', conteudo: '' })
    const resultado = await criarRecado(null, fd)
    expect(resultado?.erro).toBeDefined()
    expect(resultado?.campo).toBe('conteudo')
  })

  it('retorna erro para título excedendo 100 caracteres', async () => {
    const fd = makeFormData({
      titulo: 'A'.repeat(101),
      conteudo: 'Conteúdo válido',
    })
    const resultado = await criarRecado(null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('retorna erro para conteúdo excedendo 2000 caracteres', async () => {
    const fd = makeFormData({
      titulo: 'Aviso',
      conteudo: 'X'.repeat(2001),
    })
    const resultado = await criarRecado(null, fd)
    expect(resultado?.erro).toBeDefined()
  })

  it('cria recado normal com sucesso', async () => {
    mockDb.insert.mockReturnValue(mkInsertOk())
    const fd = makeFormData({
      titulo: 'Aviso Importante',
      conteudo: 'Reunião às 19h na sede',
      prioridade: 'normal',
    })
    const resultado = await criarRecado(null, fd)
    expect(resultado).toBeNull()
  })

  it('cria recado urgente fixado com sucesso', async () => {
    mockDb.insert.mockReturnValue(mkInsertOk())
    const fd = makeFormData({
      titulo: 'ATENÇÃO',
      conteudo: 'Sessão extraordinária hoje!',
      prioridade: 'urgente',
      fixado: 'on',
    })
    const resultado = await criarRecado(null, fd)
    expect(resultado).toBeNull()
  })

  it('usa prioridade "normal" como padrão quando não informada', async () => {
    mockDb.insert.mockReturnValue(mkInsertOk())
    const fd = makeFormData({
      titulo: 'Aviso Simples',
      conteudo: 'Informação de rotina',
    })
    const resultado = await criarRecado(null, fd)
    expect(resultado).toBeNull()
  })

  it('retorna erro quando DB falha', async () => {
    mockDb.insert.mockReturnValue(mkInsertErr('insert error'))
    const fd = makeFormData({
      titulo: 'Aviso',
      conteudo: 'Conteúdo',
    })
    const resultado = await criarRecado(null, fd)
    expect(resultado?.erro).toBe('Erro ao criar recado. Tente novamente.')
  })

  it('retorna erro para prioridade inválida', async () => {
    const fd = makeFormData({
      titulo: 'Aviso',
      conteudo: 'Conteúdo',
      prioridade: 'critico', // valor não permitido
    })
    const resultado = await criarRecado(null, fd)
    expect(resultado?.erro).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// editarRecado
// ─────────────────────────────────────────────────────────────────────────────
describe('editarRecado', () => {
  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const fd = makeFormData({ titulo: 'Aviso', conteudo: 'Conteúdo' })
    const resultado = await editarRecado('rec-1', null, fd)
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('edita recado com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateOk())
    const fd = makeFormData({
      titulo: 'Título Atualizado',
      conteudo: 'Conteúdo novo',
      prioridade: 'importante',
      fixado: 'on',
    })
    const resultado = await editarRecado('rec-1', null, fd)
    expect(resultado).toBeNull()
  })

  it('retorna erro de validação para título muito curto', async () => {
    const fd = makeFormData({ titulo: 'X', conteudo: 'Conteúdo válido' })
    const resultado = await editarRecado('rec-1', null, fd)
    expect(resultado?.erro).toBeDefined()
    expect(resultado?.campo).toBe('titulo')
  })

  it('retorna erro quando DB falha', async () => {
    mockDb.update.mockReturnValue(mkUpdateErr('update error'))
    const fd = makeFormData({ titulo: 'Título OK', conteudo: 'Conteúdo OK' })
    const resultado = await editarRecado('rec-1', null, fd)
    expect(resultado?.erro).toBe('Erro ao editar recado.')
  })

  it('reseta fixado=false quando checkbox não está marcado', async () => {
    mockDb.update.mockReturnValue(mkUpdateOk())
    // Sem 'fixado: on' → fixado não será 'on' → coerce.boolean() → false
    const fd = makeFormData({ titulo: 'Aviso', conteudo: 'Conteúdo' })
    const resultado = await editarRecado('rec-1', null, fd)
    expect(resultado).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// excluirRecado (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
describe('excluirRecado', () => {
  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await excluirRecado('rec-1')
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('faz soft delete (ativo=false) com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateOk())
    const resultado = await excluirRecado('rec-1')
    expect(resultado).toEqual({})
  })

  it('retorna erro quando DB falha', async () => {
    mockDb.update.mockReturnValue(mkUpdateErr('update fail'))
    const resultado = await excluirRecado('rec-1')
    expect(resultado).toEqual({ erro: 'Erro ao excluir recado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// toggleFixadoRecado
// ─────────────────────────────────────────────────────────────────────────────
describe('toggleFixadoRecado', () => {
  it('retorna erro quando não autenticado', async () => {
    mockAuth.mockResolvedValue(mkSessionClient(null))
    const resultado = await toggleFixadoRecado('rec-1', true)
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('fixa recado com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateOk())
    const resultado = await toggleFixadoRecado('rec-1', true)
    expect(resultado).toEqual({})
  })

  it('desfixa recado com sucesso', async () => {
    mockDb.update.mockReturnValue(mkUpdateOk())
    const resultado = await toggleFixadoRecado('rec-1', false)
    expect(resultado).toEqual({})
  })

  it('retorna erro quando DB falha', async () => {
    mockDb.update.mockReturnValue(mkUpdateErr('update fail'))
    const resultado = await toggleFixadoRecado('rec-1', true)
    expect(resultado).toEqual({ erro: 'Erro ao atualizar recado.' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist de emails — recados.ts
// ─────────────────────────────────────────────────────────────────────────────
describe('verificarAdmin em recados — whitelist', () => {
  it('bloqueia usuário fora da whitelist', async () => {
    process.env.ADMIN_EMAILS = 'super@admin.com'
    mockAuth.mockResolvedValue(
      mkSessionClient({ email: 'outro@user.com', id: 'uid-2' })
    )
    const fd = makeFormData({ titulo: 'Aviso', conteudo: 'Texto' })
    const resultado = await criarRecado(null, fd)
    expect(resultado).toEqual({ erro: 'Não autorizado.' })
  })

  it('permite usuário dentro da whitelist', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    mockAuth.mockResolvedValue(
      mkSessionClient({ email: 'admin@test.com', id: 'uid-admin' })
    )
    mockDb.insert.mockReturnValue(mkInsertOk())
    const fd = makeFormData({ titulo: 'Aviso', conteudo: 'Texto válido' })
    const resultado = await criarRecado(null, fd)
    expect(resultado).toBeNull()
  })
})
