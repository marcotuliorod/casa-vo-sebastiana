// Proteção de rotas: /admin/* requer autenticação Supabase

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { emailAutorizado } from '@/lib/auth/emails'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Só proteger rotas /admin
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          })
        },
      },
    }
  )

  // getUser() revalida o token contra o servidor de Auth (getSession() só decodifica o cookie local)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !emailAutorizado(user.email)) {
    const loginUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
