// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { emailConfigurado, enviarEmail, listaDeEmails } from '@/lib/email/cliente'

const EMAIL = { assunto: 'Assunto', texto: 'texto', html: '<p>html</p>' }

function mockFetch(status: number, corpo: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(corpo), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_teste'
  process.env.EMAIL_FROM = 'Casa <contato@exemplo.com>'
  delete process.env.AUTH_EMAIL_FROM
  delete process.env.EMAIL_REPLY_TO
})
afterEach(() => vi.unstubAllGlobals())

describe('listaDeEmails', () => {
  it('separa por vírgula, tira espaços e vazios', () => {
    expect(listaDeEmails(' a@x.com , b@y.com,, ')).toEqual(['a@x.com', 'b@y.com'])
  })
  it('null/undefined/vazio → lista vazia', () => {
    expect(listaDeEmails(null)).toEqual([])
    expect(listaDeEmails(undefined)).toEqual([])
    expect(listaDeEmails('')).toEqual([])
  })
})

describe('emailConfigurado', () => {
  it('exige chave e remetente', () => {
    expect(emailConfigurado()).toBe(true)
    delete process.env.RESEND_API_KEY
    expect(emailConfigurado()).toBe(false)
  })
  it('usa AUTH_EMAIL_FROM como remetente quando não há EMAIL_FROM', () => {
    delete process.env.EMAIL_FROM
    expect(emailConfigurado()).toBe(false)
    process.env.AUTH_EMAIL_FROM = 'Login <login@exemplo.com>'
    expect(emailConfigurado()).toBe(true)
  })
})

describe('enviarEmail', () => {
  it('chama a API do Resend com remetente, destinatários e conteúdo', async () => {
    const fetchMock = mockFetch(200, { id: 'msg-1' })

    const resultado = await enviarEmail(['a@x.com', 'b@y.com'], EMAIL)

    expect(resultado).toEqual({ sucesso: true, idMensagem: 'msg-1' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_teste')
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Casa <contato@exemplo.com>',
      to: ['a@x.com', 'b@y.com'],
      subject: 'Assunto',
      html: '<p>html</p>',
      text: 'texto',
    })
  })

  it('inclui reply_to quando EMAIL_REPLY_TO está definido', async () => {
    process.env.EMAIL_REPLY_TO = 'casa@exemplo.com'
    const fetchMock = mockFetch(200, { id: 'msg-1' })

    await enviarEmail(['a@x.com'], EMAIL)

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(init.body as string).reply_to).toBe('casa@exemplo.com')
  })

  it('erro da API volta como sucesso:false com a mensagem do Resend', async () => {
    mockFetch(403, { name: 'validation_error', message: 'Domínio não verificado' })

    expect(await enviarEmail(['a@x.com'], EMAIL)).toEqual({ sucesso: false, erro: 'Domínio não verificado' })
  })

  it('lança quando não está configurado (vira item da fila em quem chama)', async () => {
    delete process.env.RESEND_API_KEY
    const fetchMock = mockFetch(200, {})

    await expect(enviarEmail(['a@x.com'], EMAIL)).rejects.toThrow(/RESEND_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
