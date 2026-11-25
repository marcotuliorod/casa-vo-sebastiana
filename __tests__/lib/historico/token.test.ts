import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { gerarTokenHistorico, verificarTokenHistorico, TTL_HISTORICO_MS } from '@/lib/historico/token'

const AGORA = Date.UTC(2026, 10, 25, 12, 0, 0)

describe('token do histórico', () => {
  const segredoOriginal = process.env.AUTH_SECRET
  beforeEach(() => {
    process.env.AUTH_SECRET = 'segredo-de-teste'
  })
  afterEach(() => {
    process.env.AUTH_SECRET = segredoOriginal
  })

  it('valida o próprio token e devolve o e-mail em minúsculas', () => {
    const token = gerarTokenHistorico('  Maria@Exemplo.com ', AGORA)
    expect(verificarTokenHistorico(token, AGORA + 1000)).toEqual({
      email: 'maria@exemplo.com',
      expiraEm: AGORA + TTL_HISTORICO_MS,
    })
  })

  it('recusa o token depois de expirar', () => {
    const token = gerarTokenHistorico('maria@exemplo.com', AGORA)
    expect(verificarTokenHistorico(token, AGORA + TTL_HISTORICO_MS - 1)).not.toBeNull()
    expect(verificarTokenHistorico(token, AGORA + TTL_HISTORICO_MS)).toBeNull()
  })

  it('recusa token com o e-mail trocado (assinatura não bate)', () => {
    const token = gerarTokenHistorico('maria@exemplo.com', AGORA)
    const [, assinatura] = token.split('.')
    const corpoFalso = Buffer.from(
      JSON.stringify({ e: 'outra@exemplo.com', x: AGORA + TTL_HISTORICO_MS })
    ).toString('base64url')
    expect(verificarTokenHistorico(`${corpoFalso}.${assinatura}`, AGORA)).toBeNull()
  })

  it('recusa token assinado com outro segredo', () => {
    const token = gerarTokenHistorico('maria@exemplo.com', AGORA)
    process.env.AUTH_SECRET = 'outro-segredo'
    expect(verificarTokenHistorico(token, AGORA)).toBeNull()
  })

  it.each([undefined, null, '', 'sem-ponto', 'a.b.c', '.', 'xxx.yyy'])(
    'recusa token malformado: %s',
    (token) => {
      expect(verificarTokenHistorico(token, AGORA)).toBeNull()
    }
  )

  it('falha alto se AUTH_SECRET não estiver configurado', () => {
    delete process.env.AUTH_SECRET
    expect(() => gerarTokenHistorico('maria@exemplo.com', AGORA)).toThrow(/AUTH_SECRET/)
  })
})
