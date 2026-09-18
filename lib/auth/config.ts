// Configuração completa do Auth.js (Node.js runtime) — usada por Server
// Actions, Server Components e pela rota de API do Auth.js. NÃO importar isto
// em middleware.ts (ver lib/auth/config.edge.ts).

import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/db'
import { authUsers, authAccounts, authSessions, authVerificationTokens } from '@/lib/db/schema'
import { authConfig } from './config.edge'
import { emailAutorizado } from './emails'
import { enviarLinkDeAcesso } from './link-email'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: authUsers,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM,
      sendVerificationRequest: enviarLinkDeAcesso,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Mesma allowlist que o middleware re-checa a cada request (lib/auth/emails.ts)
    async signIn({ user }) {
      return emailAutorizado(user.email)
    },
  },
})
