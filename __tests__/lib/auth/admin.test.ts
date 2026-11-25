import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth/config'
import { emailAutorizado } from '@/lib/auth/emails'
import { getAdminUser, verificarAdmin } from '@/lib/auth/admin'

const mockAuth = auth as ReturnType<typeof vi.fn>

function mkSession(user: { email: string; id: string } | null) {
  return user ? { user, expires: '2099-01-01T00:00:00.000Z' } : null
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ADMIN_EMAILS
  delete process.env.ADMIN_EMAIL_NOTIFICACOES
})

describe('emailAutorizado', () => {
  it('bloqueia todo mundo quando ADMIN_EMAILS e ADMIN_EMAIL_NOTIFICACOES estão vazios', () => {
    expect(emailAutorizado('qualquer@example.com')).toBe(false)
    process.env.ADMIN_EMAILS = ' , '
    expect(emailAutorizado('qualquer@example.com')).toBe(false)
  })

  it('sem ADMIN_EMAILS, autoriza só quem recebe os avisos da Casa', () => {
    process.env.ADMIN_EMAIL_NOTIFICACOES = 'Casa@Exemplo.com, mae@exemplo.com'
    expect(emailAutorizado('casa@exemplo.com')).toBe(true)
    expect(emailAutorizado('mae@exemplo.com')).toBe(true)
    expect(emailAutorizado('intruso@exemplo.com')).toBe(false)
  })

  it('com ADMIN_EMAILS preenchido, quem só recebe avisos não entra', () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    process.env.ADMIN_EMAIL_NOTIFICACOES = 'avisos@test.com'
    expect(emailAutorizado('admin@test.com')).toBe(true)
    expect(emailAutorizado('avisos@test.com')).toBe(false)
  })

  it('autoriza email presente na whitelist, ignorando espaços', () => {
    process.env.ADMIN_EMAILS = ' admin@test.com, outro@test.com '
    expect(emailAutorizado('admin@test.com')).toBe(true)
    expect(emailAutorizado('outro@test.com')).toBe(true)
  })

  it('é case-insensitive', () => {
    process.env.ADMIN_EMAILS = 'Admin@Test.com'
    expect(emailAutorizado('admin@test.com')).toBe(true)
  })

  it('bloqueia email fora da whitelist', () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    expect(emailAutorizado('intruso@test.com')).toBe(false)
  })

  it('bloqueia email nulo/indefinido quando há whitelist', () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    expect(emailAutorizado(null)).toBe(false)
    expect(emailAutorizado(undefined)).toBe(false)
  })
})

describe('getAdminUser / verificarAdmin', () => {
  it('retorna null quando não há sessão', async () => {
    mockAuth.mockResolvedValue(mkSession(null))
    expect(await getAdminUser()).toBeNull()
    expect(await verificarAdmin()).toBe('Não autorizado.')
  })

  it('retorna null quando o usuário autenticado não está na whitelist', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    mockAuth.mockResolvedValue(mkSession({ email: 'intruso@test.com', id: 'uid-1' }))
    expect(await getAdminUser()).toBeNull()
    expect(await verificarAdmin()).toBe('Não autorizado.')
  })

  it('retorna o usuário quando autenticado e autorizado', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    const user = { email: 'admin@test.com', id: 'uid-1' }
    mockAuth.mockResolvedValue(mkSession(user))
    expect(await getAdminUser()).toEqual(user)
    expect(await verificarAdmin()).toBeNull()
  })

  it('recusa usuário autenticado quando nenhuma lista está configurada', async () => {
    mockAuth.mockResolvedValue(mkSession({ email: 'ninguem-configurado@test.com', id: 'uid-2' }))
    expect(await verificarAdmin()).toBe('Não autorizado.')
  })
})
