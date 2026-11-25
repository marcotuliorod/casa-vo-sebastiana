// Lógica pura da allowlist de admins — sem dependências de runtime (Node ou next/headers),
// para poder ser importada tanto pelo Edge Middleware quanto por Server Components/Actions.

function lista(valor: string | undefined): string[] {
  return (
    valor
      ?.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? []
  )
}

// Quem pode entrar no /admin:
// 1. os e-mails de ADMIN_EMAILS, quando a lista está preenchida;
// 2. senão, quem recebe os avisos da Casa (ADMIN_EMAIL_NOTIFICACOES);
// 3. senão, ninguém. Lista vazia nunca libera qualquer login.
function emailsAutorizados(): string[] {
  const admins = lista(process.env.ADMIN_EMAILS)
  if (admins.length > 0) return admins
  return lista(process.env.ADMIN_EMAIL_NOTIFICACOES)
}

export function emailAutorizado(email: string | null | undefined): boolean {
  if (!email) return false
  return emailsAutorizados().includes(email.trim().toLowerCase())
}
