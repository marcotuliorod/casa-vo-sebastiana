// Liveness para o healthcheck do Docker: só confirma que o servidor Next responde.
// Não consulta o banco (o Postgres tem healthcheck próprio).
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ ok: true })
}
