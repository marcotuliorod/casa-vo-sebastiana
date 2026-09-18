import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { montarUrlDeConfirmacao, enviarLinkDeAcesso } from '@/lib/auth/link-email'

const URL_AUTHJS =
  'https://agenda.mtrm.tech/api/auth/callback/resend?callbackUrl=https%3A%2F%2Fagenda.mtrm.tech&token=abc123&email=a%40b.com'

describe('montarUrlDeConfirmacao', () => {
  it('aponta para /auth/confirmar no mesmo host e preserva token, email e callbackUrl', () => {
    const url = new URL(montarUrlDeConfirmacao(URL_AUTHJS))
    expect(url.origin).toBe('https://agenda.mtrm.tech')
    expect(url.pathname).toBe('/auth/confirmar')
    expect(url.searchParams.get('token')).toBe('abc123')
    expect(url.searchParams.get('email')).toBe('a@b.com')
    expect(url.searchParams.get('callbackUrl')).toBe('https://agenda.mtrm.tech')
  })

  it('não expõe o endpoint de callback (que consome o token) no link do e-mail', () => {
    expect(montarUrlDeConfirmacao(URL_AUTHJS)).not.toContain('/api/auth/callback')
  })
})

describe('enviarLinkDeAcesso', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('envia o e-mail pela API do Resend com o link de confirmação', async () => {
    fetchMock.mockResolvedValue({ ok: true })
    await enviarLinkDeAcesso({
      identifier: 'a@b.com',
      url: URL_AUTHJS,
      provider: { apiKey: 're_test', from: 'Casa <login@x.com>' },
    })

    const [endpoint, init] = fetchMock.mock.calls[0]
    expect(endpoint).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_test')
    const body = JSON.parse(init.body)
    expect(body.to).toBe('a@b.com')
    expect(body.text).toContain('/auth/confirmar?')
    expect(body.html).toContain('/auth/confirmar?')
    expect(body.html).not.toContain('/api/auth/callback')
  })

  it('lança erro quando o Resend rejeita', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'invalid' }) })
    await expect(
      enviarLinkDeAcesso({ identifier: 'a@b.com', url: URL_AUTHJS, provider: { apiKey: 'x', from: 'y' } }),
    ).rejects.toThrow('Resend error')
  })
})
