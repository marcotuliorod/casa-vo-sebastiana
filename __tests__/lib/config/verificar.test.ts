import { describe, it, expect } from 'vitest'
import { verificarConfiguracao } from '@/lib/config/verificar'

const COMPLETA = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://app:x@postgres:5432/casa',
  AUTH_SECRET: 'segredo',
  RESEND_API_KEY: 're_x',
  EMAIL_FROM: 'Casa <contato@exemplo.com>',
  ADMIN_EMAILS: 'admin@exemplo.com',
  CRON_SECRET: 'x'.repeat(40),
  NEXT_PUBLIC_BASE_URL: 'https://agenda.exemplo.com',
} as unknown as NodeJS.ProcessEnv

describe('verificarConfiguracao', () => {
  it('configuração completa: sem erros nem avisos', () => {
    expect(verificarConfiguracao(COMPLETA)).toEqual({ erros: [], avisos: [] })
  })

  it.each(['DATABASE_URL', 'AUTH_SECRET'])('sem %s é erro (o app não sobe em produção)', (nome) => {
    const r = verificarConfiguracao({ ...COMPLETA, [nome]: '' })
    expect(r.erros).toHaveLength(1)
    expect(r.erros[0]).toContain(nome)
  })

  it('e-mail, admins, cron e endereço do site geram só avisos', () => {
    const r = verificarConfiguracao({
      ...COMPLETA,
      RESEND_API_KEY: '',
      ADMIN_EMAILS: '',
      CRON_SECRET: 'curto',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
    })
    expect(r.erros).toEqual([])
    expect(r.avisos).toHaveLength(4)
  })

  it('EMAIL_FROM vazio com AUTH_EMAIL_FROM preenchido não é problema', () => {
    const r = verificarConfiguracao({ ...COMPLETA, EMAIL_FROM: '', AUTH_EMAIL_FROM: 'Casa <login@exemplo.com>' })
    expect(r.avisos).toEqual([])
  })

  it('ADMIN_EMAIL_NOTIFICACOES sozinho já permite entrar no painel', () => {
    const r = verificarConfiguracao({ ...COMPLETA, ADMIN_EMAILS: '', ADMIN_EMAIL_NOTIFICACOES: 'casa@exemplo.com' })
    expect(r.avisos).toEqual([])
  })
})
