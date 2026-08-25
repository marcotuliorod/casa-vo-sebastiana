// Webhook de status do Z-API
// Configura em: Painel Z-API → Webhook de Status de Mensagem

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logsWhatsapp } from '@/lib/db/schema'

interface ZApiStatusPayload {
  instanceId?: string
  messageId?: string
  zaapId?: string
  status?: string // 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
}

const mapearStatus = (status: string): 'na_fila' | 'enviado' | 'entregue' | 'falhou' => {
  const mapa: Record<string, 'na_fila' | 'enviado' | 'entregue' | 'falhou'> = {
    PENDING: 'na_fila',
    SENT: 'enviado',
    DELIVERED: 'entregue',
    READ: 'entregue',
    FAILED: 'falhou',
  }
  return mapa[status?.toUpperCase()] ?? 'na_fila'
}

export async function POST(request: NextRequest) {
  // Verificar Client-Token do Z-API — obrigatório para prevenir requisições forjadas
  const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!zapiClientToken) {
    console.error('[Z-API Webhook] ZAPI_CLIENT_TOKEN não configurado — rejeitando requisição')
    return NextResponse.json({ erro: 'Serviço não configurado' }, { status: 500 })
  }

  const clientToken = request.headers.get('client-token')
  if (clientToken !== zapiClientToken) {
    return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  }

  let payload: ZApiStatusPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Payload inválido' }, { status: 400 })
  }

  const idMensagem = payload.zaapId ?? payload.messageId
  if (!idMensagem || !payload.status) {
    return NextResponse.json({ ok: true }) // ignorar payloads sem ID
  }

  const novoStatus = mapearStatus(payload.status)

  await db
    .update(logsWhatsapp)
    .set({ status: novoStatus, atualizadoEm: new Date() })
    .where(eq(logsWhatsapp.idMensagemProvedor, idMensagem))

  return NextResponse.json({ ok: true })
}
