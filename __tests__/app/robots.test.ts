import { describe, it, expect } from 'vitest'
import robots from '@/app/robots'

describe('robots.txt', () => {
  it('libera as páginas públicas e bloqueia painel e API', () => {
    const r = robots()
    const regra = Array.isArray(r.rules) ? r.rules[0] : r.rules
    expect(regra.allow).toBe('/')
    expect(regra.disallow).toEqual(['/admin', '/api/'])
  })

  it('não bloqueia páginas com noindex (o buscador precisa ler o noindex)', () => {
    const r = robots()
    const regra = Array.isArray(r.rules) ? r.rules[0] : r.rules
    for (const caminho of ['/agendamento', '/historico', '/mediuns']) {
      expect(regra.disallow).not.toContain(caminho)
    }
  })
})
