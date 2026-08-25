import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSessionClient: vi.fn(),
}))

import { createServerSessionClient } from '@/lib/supabase/server'
import { emailAutorizado } from '@/lib/auth/emails'
import { getAdminUser, verificarAdmin } from '@/lib/auth/admin'

const mockCreateServerSessionClient = createServerSessionClient as ReturnType<typeof vi.fn>

function mkSessionClient(user: { email: string; id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ADMIN_EMAILS
})

describe('emailAutorizado', () => {
  it('autoriza qualquer email quando ADMIN_EMAILS está vazio', () => {
    delete process.env.ADMIN_EMAILS
    expect(emailAutorizado('qualquer@example.com')).toBe(true)
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
  it('retorna null quando não há usuário autenticado', async () => {
    mockCreateServerSessionClient.mockResolvedValue(mkSessionClient(null))
    expect(await getAdminUser()).toBeNull()
    expect(await verificarAdmin()).toBe('Não autorizado.')
  })

  it('retorna null quando o usuário autenticado não está na whitelist', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    mockCreateServerSessionClient.mockResolvedValue(
      mkSessionClient({ email: 'intruso@test.com', id: 'uid-1' })
    )
    expect(await getAdminUser()).toBeNull()
    expect(await verificarAdmin()).toBe('Não autorizado.')
  })

  it('retorna o usuário quando autenticado e autorizado', async () => {
    process.env.ADMIN_EMAILS = 'admin@test.com'
    const user = { email: 'admin@test.com', id: 'uid-1' }
    mockCreateServerSessionClient.mockResolvedValue(mkSessionClient(user))
    expect(await getAdminUser()).toEqual(user)
    expect(await verificarAdmin()).toBeNull()
  })

  it('permite qualquer usuário autenticado quando ADMIN_EMAILS está vazio', async () => {
    mockCreateServerSessionClient.mockResolvedValue(
      mkSessionClient({ email: 'ninguem-configurado@test.com', id: 'uid-2' })
    )
    expect(await verificarAdmin()).toBeNull()
  })
})
