// Webhook de status do Z-API
// Configura em: Painel Z-API → Webhook de Status de Mensagem

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

interface ZApiStatusPayload {
  instanceId?: string
  messageId?: string
  zaapId?: string
  status?: string // 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
}

const mapearStatus = (status: string): string => {
  const mapa: Record<string, string> = {
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

  const supabase = createAdminClient()
  const novoStatus = mapearStatus(payload.status)

  await supabase
    .from('logs_whatsapp')
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq('id_mensagem_provedor', idMensagem)

  return NextResponse.json({ ok: true })
}
