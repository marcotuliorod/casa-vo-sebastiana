import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const onConflictDoUpdate = vi.fn()
const values = vi.fn(() => ({ onConflictDoUpdate }))
vi.mock('@/lib/db', () => ({ db: { insert: vi.fn(() => ({ values })) } }))
vi.mock('@/lib/auth/config', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth/config'
import { salvarInfoCasa } from '@/lib/actions/casa'

const mockAuth = auth as ReturnType<typeof vi.fn>

function form(campos: Record<string, string> = {}) {
  const fd = new FormData()
  const padrao = {
    endereco: 'Rua das Flores, 10 — Centro',
    link_mapa: 'https://maps.app.goo.gl/abc',
    email_contato: 'Contato@Casa.org',
    telefone_contato: '(11) 99999-9999',
    orientacoes: 'Chegue 15 minutos antes.',
    politica_cancelamento: '',
    responsavel_dados: 'Associação Casa de Vó Sebastiana',
  }
  Object.entries({ ...padrao, ...campos }).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ADMIN_EMAILS = 'admin@test.com'
  mockAuth.mockResolvedValue({ user: { email: 'admin@test.com', id: 'u1' }, expires: '2099-01-01T00:00:00.000Z' })
  onConflictDoUpdate.mockResolvedValue([])
})

describe('salvarInfoCasa', () => {
  it('exige login de administrador', async () => {
    mockAuth.mockResolvedValue(null)
    expect(await salvarInfoCasa(null, form())).toEqual({ erro: 'Não autorizado.' })
    expect(values).not.toHaveBeenCalled()
  })

  it('salva a linha única (id 1), com e-mail em minúsculas e campos vazios como null', async () => {
    expect(await salvarInfoCasa(null, form())).toEqual({ ok: true })
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        endereco: 'Rua das Flores, 10 — Centro',
        emailContato: 'contato@casa.org',
        politicaCancelamento: null,
      })
    )
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ orientacoes: 'Chegue 15 minutos antes.' }) })
    )
  })

  it('aceita tudo em branco (apaga as informações)', async () => {
    const vazio = Object.fromEntries(
      ['endereco', 'link_mapa', 'email_contato', 'telefone_contato', 'orientacoes', 'politica_cancelamento', 'responsavel_dados'].map((c) => [c, ''])
    )
    expect(await salvarInfoCasa(null, form(vazio))).toEqual({ ok: true })
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ endereco: null, linkMapa: null, emailContato: null }))
  })

  it.each(['http://maps.google.com/x', 'maps.google.com', 'javascript:alert(1)'])(
    'recusa link do mapa que não começa com https:// (%s)',
    async (link) => {
      const r = await salvarInfoCasa(null, form({ link_mapa: link }))
      expect(r?.campo).toBe('link_mapa')
      expect(values).not.toHaveBeenCalled()
    }
  )

  it('recusa e-mail de contato inválido', async () => {
    const r = await salvarInfoCasa(null, form({ email_contato: 'casa@' }))
    expect(r).toEqual({ erro: 'E-mail de contato inválido', campo: 'email_contato' })
  })

  it('recusa texto longo demais', async () => {
    const r = await salvarInfoCasa(null, form({ orientacoes: 'x'.repeat(2001) }))
    expect(r?.campo).toBe('orientacoes')
  })

  it('devolve o erro do banco', async () => {
    onConflictDoUpdate.mockRejectedValue(new Error('falha no banco'))
    expect(await salvarInfoCasa(null, form())).toEqual({ erro: 'falha no banco' })
  })
})
