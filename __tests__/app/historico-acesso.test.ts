// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/historico/acesso/route'
import { gerarTokenHistorico, TTL_HISTORICO_MS } from '@/lib/historico/token'

function req(t?: string) {
  const url = new URL('http://interno:3000/historico/acesso')
  if (t !== undefined) url.searchParams.set('t', t)
  return new NextRequest(url)
}

describe('GET /historico/acesso', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'segredo-de-teste'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://casa.exemplo'
  })

  it('com token válido grava o cookie e redireciona para /historico', async () => {
    const token = gerarTokenHistorico('maria@exemplo.com')
    const res = await GET(req(token))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://casa.exemplo/historico')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')

    const cookie = res.cookies.get('cvs_historico')
    expect(cookie?.value).toBe(token)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.path).toBe('/historico')
    expect(cookie?.sameSite).toBe('lax')
  })

  it.each([undefined, '', 'lixo', gerarTokenHistoricoExpirado()])(
    'com token ausente, inválido ou expirado não grava cookie e avisa',
    async (t) => {
      const res = await GET(req(t))
      expect(res.headers.get('location')).toBe('https://casa.exemplo/historico?link=invalido')
      expect(res.cookies.get('cvs_historico')).toBeUndefined()
    }
  )
})

function gerarTokenHistoricoExpirado() {
  process.env.AUTH_SECRET = 'segredo-de-teste'
  return gerarTokenHistorico('maria@exemplo.com', Date.now() - TTL_HISTORICO_MS - 1)
}
