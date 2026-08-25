// Lógica pura da allowlist de admins — sem dependências de runtime (Node ou next/headers),
// para poder ser importada tanto pelo Edge Middleware quanto por Server Components/Actions.

function emailsAutorizados(): string[] {
  return (
    process.env.ADMIN_EMAILS
      ?.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? []
  )
}

// Se ADMIN_EMAILS estiver vazio, qualquer usuário autenticado é admin (comportamento documentado).
export function emailAutorizado(email: string | null | undefined): boolean {
  const permitidos = emailsAutorizados()
  if (permitidos.length === 0) return true
  return permitidos.includes((email ?? '').toLowerCase())
}
