import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn() }))

import { headers } from 'next/headers'
import { consumirLimite, ipDaRequisicao, zerarLimites } from '@/lib/rate-limit'

const LIMITE = { max: 3, janelaMs: 60_000 }

describe('consumirLimite', () => {
  beforeEach(() => zerarLimites())

  it('aceita até o máximo e recusa a seguinte', () => {
    expect([1, 2, 3].map((i) => consumirLimite('a', LIMITE, i))).toEqual([true, true, true])
    expect(consumirLimite('a', LIMITE, 4)).toBe(false)
  })

  it('volta a aceitar quando as tentativas antigas saem da janela', () => {
    for (const t of [0, 10, 20]) consumirLimite('a', LIMITE, t)
    expect(consumirLimite('a', LIMITE, 59_999)).toBe(false)
    expect(consumirLimite('a', LIMITE, 60_001)).toBe(true)
  })

  it('tentativas recusadas não prolongam o bloqueio', () => {
    for (const t of [0, 1, 2]) consumirLimite('a', LIMITE, t)
    for (let t = 100; t < 50_000; t += 1000) expect(consumirLimite('a', LIMITE, t)).toBe(false)
    expect(consumirLimite('a', LIMITE, 60_003)).toBe(true)
  })

  it('chaves diferentes têm contagens separadas', () => {
    for (const t of [0, 1, 2]) consumirLimite('a', LIMITE, t)
    expect(consumirLimite('a', LIMITE, 3)).toBe(false)
    expect(consumirLimite('b', LIMITE, 3)).toBe(true)
  })
})

describe('ipDaRequisicao', () => {
  const comHeaders = (h: Record<string, string>) =>
    vi.mocked(headers).mockResolvedValue(new Headers(h) as never)

  it('prefere X-Real-Ip', async () => {
    comHeaders({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' })
    expect(await ipDaRequisicao()).toBe('1.1.1.1')
  })

  it('usa o último endereço do X-Forwarded-For (o que o proxy acrescentou)', async () => {
    comHeaders({ 'x-forwarded-for': '6.6.6.6, 2.2.2.2' })
    expect(await ipDaRequisicao()).toBe('2.2.2.2')
  })

  it('sem cabeçalhos devolve "desconhecido"', async () => {
    comHeaders({})
    expect(await ipDaRequisicao()).toBe('desconhecido')
  })

  it('fora de uma requisição devolve "desconhecido"', async () => {
    vi.mocked(headers).mockRejectedValue(new Error('fora de contexto'))
    expect(await ipDaRequisicao()).toBe('desconhecido')
  })
})
