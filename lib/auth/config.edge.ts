// Config Auth.js compartilhada e "edge-safe" — SEM adapter e SEM providers que
// tocam o banco. O middleware.ts roda em Edge Runtime, que não suporta o driver
// `postgres` (TCP/Node). Importar o adapter aqui quebraria o middleware mesmo
// com sessão JWT, porque o import por si só já puxa o driver Node para o bundle.
//
// middleware.ts usa só esta config (decodifica/valida o JWT do cookie, sem
// tocar o banco). lib/auth/config.ts usa esta config + adapter + providers
// para tudo que roda em Node.js runtime (Server Actions, Server Components,
// as rotas de API do Auth.js).

import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  // Self-hosted atrás do proxy Caddy (Fase 0) — sem isso o Auth.js rejeita
  // qualquer Host header com UntrustedHost (proteção pensada pra quem não está
  // atrás de uma plataforma que já valida isso, como a Vercel).
  trustHost: true,
  providers: [],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? ''
      return session
    },
  },
}
