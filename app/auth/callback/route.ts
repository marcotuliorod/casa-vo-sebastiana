import { NextRequest, NextResponse } from 'next/server'
import { createServerSessionClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSessionClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}/admin`)
    }
  }

  // Erro: redirecionar para login com mensagem
  return NextResponse.redirect(`${origin}/auth/login?erro=link_invalido`)
}
