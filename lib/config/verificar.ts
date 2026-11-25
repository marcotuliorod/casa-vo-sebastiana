// Confere as variáveis de ambiente quando o servidor sobe (instrumentation.ts).
// Sem banco ou sem segredo de sessão o app não funciona: em produção ele nem sobe,
// o healthcheck falha e o deploy volta sozinho para a versão anterior.
// As demais só geram aviso no log (o site funciona, mas algo fica sem enviar).

export interface ResultadoConfiguracao {
  erros: string[]
  avisos: string[]
}

export function verificarConfiguracao(env: NodeJS.ProcessEnv = process.env): ResultadoConfiguracao {
  const erros: string[] = []
  const avisos: string[] = []
  const vazio = (nome: string) => !env[nome]?.trim()

  if (vazio('DATABASE_URL')) erros.push('DATABASE_URL não configurada: o site não acessa o banco.')
  if (vazio('AUTH_SECRET')) erros.push('AUTH_SECRET não configurada: o login do painel não funciona.')

  if (vazio('RESEND_API_KEY') || (vazio('EMAIL_FROM') && vazio('AUTH_EMAIL_FROM'))) {
    avisos.push('RESEND_API_KEY ou EMAIL_FROM vazios: nenhum e-mail é enviado (ficam na fila).')
  }
  if (vazio('ADMIN_EMAILS') && vazio('ADMIN_EMAIL_NOTIFICACOES')) {
    avisos.push('ADMIN_EMAILS e ADMIN_EMAIL_NOTIFICACOES vazios: ninguém entra no painel.')
  }
  if ((env.CRON_SECRET?.length ?? 0) < 32) {
    avisos.push('CRON_SECRET vazio ou curto (mínimo 32): lembretes e reenvios não rodam.')
  }
  const base = env.NEXT_PUBLIC_BASE_URL ?? ''
  if (env.NODE_ENV === 'production' && (!base || base.includes('localhost'))) {
    avisos.push('NEXT_PUBLIC_BASE_URL vazia ou com localhost: os links dos e-mails ficam errados.')
  }

  return { erros, avisos }
}
