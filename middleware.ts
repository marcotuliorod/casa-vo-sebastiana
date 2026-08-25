// Proteção de rotas: /admin/* requer sessão Auth.js válida e email autorizado.
//
// Importa só a config edge-safe (lib/auth/config.edge.ts) — SEM adapter, para
// não puxar o driver `postgres` (Node/TCP) para o bundle do Edge Runtime.
// Sessão é JWT: o middleware só valida a assinatura do cookie. A allowlist é
// checada de novo aqui (defesa em profundidade: cobre o caso de ADMIN_EMAILS
// mudar depois do token já emitido).

import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config.edge'
import { emailAutorizado } from '@/lib/auth/emails'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  if (!req.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const user = req.auth?.user

  if (!user || !emailAutorizado(user.email)) {
    const loginUrl = new URL('/auth/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*'],
}
