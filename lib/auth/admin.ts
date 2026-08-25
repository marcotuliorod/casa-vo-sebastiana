// Helpers compartilhados de autorização admin — usados tanto pelo
// layout admin (gate de leitura) quanto pelas Server Actions (gate de mutação).

import { createServerSessionClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { emailAutorizado } from './emails'

export { emailAutorizado }

// Retorna o usuário autenticado E autorizado (email na allowlist), ou null.
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createServerSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !emailAutorizado(user.email)) return null
  return user
}

// Usado pelas Server Actions: retorna mensagem de erro, ou null se autorizado.
export async function verificarAdmin(): Promise<string | null> {
  const user = await getAdminUser()
  return user ? null : 'Não autorizado.'
}
