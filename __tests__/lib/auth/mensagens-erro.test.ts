import { describe, it, expect } from 'vitest'
import { mensagemDeErroDeLogin } from '@/lib/auth/mensagens-erro'

describe('mensagemDeErroDeLogin', () => {
  it('não mostra mensagem quando não há erro', () => {
    expect(mensagemDeErroDeLogin(null)).toBeNull()
    expect(mensagemDeErroDeLogin(undefined)).toBeNull()
    expect(mensagemDeErroDeLogin('')).toBeNull()
  })

  it('explica link expirado/já utilizado', () => {
    expect(mensagemDeErroDeLogin('Verification')).toMatch(/expirado ou já utilizado/i)
  })

  it('explica falta de permissão', () => {
    expect(mensagemDeErroDeLogin('AccessDenied')).toMatch(/não tem permissão/i)
  })

  it('usa mensagem genérica para outros códigos', () => {
    expect(mensagemDeErroDeLogin('Configuration')).toMatch(/não foi possível entrar/i)
  })
})
