// Saúde do app.
// - GET /api/health: liveness para o healthcheck do Docker; só confirma que o Next responde.
//   Não consulta o banco, para o Traefik não tirar o app do ar quando o banco oscila.
// - GET /api/health?deep=1: também confere o banco (usado pelo monitor scripts/saude.sh).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const TIMEOUT_BANCO_MS = 5000

async function bancoResponde(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const { db } = await import('@/lib/db')
    const limite = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => rejeitar(new Error('timeout')), TIMEOUT_BANCO_MS)
    })
    await Promise.race([db.execute(sql`select 1`), limite])
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(req: NextRequest) {
  if (!req.nextUrl.searchParams.has('deep')) {
    return NextResponse.json({ ok: true })
  }
  const banco = await bancoResponde()
  return NextResponse.json({ ok: banco, banco }, { status: banco ? 200 : 503 })
}
