// Helpers compartilhados de autorização admin — usados tanto pelo
// layout admin (gate de leitura) quanto pelas Server Actions (gate de mutação).

import { auth } from '@/lib/auth/config'
import { emailAutorizado } from './emails'

export { emailAutorizado }

type AdminUser = { id: string; email: string | null | undefined }

// Retorna o usuário autenticado E autorizado (email na allowlist), ou null.
export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await auth()
  const user = session?.user

  if (!user || !emailAutorizado(user.email)) return null
  return { id: user.id ?? '', email: user.email }
}

// Usado pelas Server Actions: retorna mensagem de erro, ou null se autorizado.
export async function verificarAdmin(): Promise<string | null> {
  const user = await getAdminUser()
  return user ? null : 'Não autorizado.'
}
