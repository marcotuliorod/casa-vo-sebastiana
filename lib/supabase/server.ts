// Cliente Supabase para o servidor (usa service_role key, bypass RLS)
// Usar apenas em Server Actions e API Routes — NUNCA expor ao cliente
//
// Ainda em uso por lib/actions/* e algumas queries que não migraram para o
// Drizzle nesta PR — ver plano de migração. createServerSessionClient()
// (cliente com contexto de sessão via cookies) foi removido: era usado só
// por app/admin/consulentes/page.tsx, já migrado para Drizzle; a
// autenticação em si já usa Auth.js (lib/auth/config.ts).
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente com service_role para operações privilegiadas (Server Actions públicas)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
