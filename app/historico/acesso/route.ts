// Destino do link enviado por e-mail: valida o token, guarda-o num cookie
// httpOnly e redireciona para /historico — assim o token sai da barra de
// endereço e o "voltar" da página do agendamento continua funcionando.

import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_HISTORICO, verificarTokenHistorico } from '@/lib/historico/token'

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? req.url
  const token = req.nextUrl.searchParams.get('t')
  const valido = verificarTokenHistorico(token)

  if (!valido) {
    return NextResponse.redirect(new URL('/historico?link=invalido', base))
  }

  const resposta = NextResponse.redirect(new URL('/historico', base))
  resposta.cookies.set(COOKIE_HISTORICO, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/historico',
    expires: new Date(valido.expiraEm),
  })
  // O token não deve ir para a página seguinte via Referer
  resposta.headers.set('Referrer-Policy', 'no-referrer')
  return resposta
}
