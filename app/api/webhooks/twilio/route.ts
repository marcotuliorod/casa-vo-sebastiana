// Webhook de status do Twilio WhatsApp
// Configurar URL no painel Twilio: Messaging → Status Callback URL

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const mapearStatus = (status: string): string => {
  const mapa: Record<string, string> = {
    queued: 'na_fila',
    sent: 'enviado',
    delivered: 'entregue',
    read: 'entregue',
    failed: 'falhou',
    undelivered: 'falhou',
  }
  return mapa[status?.toLowerCase()] ?? 'na_fila'
}

export async function POST(request: NextRequest) {
  // Twilio envia como application/x-www-form-urlencoded
  const formData = await request.formData()
  const messageSid = formData.get('MessageSid') as string | null
  const messageStatus = formData.get('MessageStatus') as string | null
  const errorCode = formData.get('ErrorCode') as string | null

  if (!messageSid || !messageStatus) {
    return new NextResponse('OK', { status: 200 })
  }

  const supabase = createAdminClient()
  const novoStatus = mapearStatus(messageStatus)

  await supabase
    .from('logs_whatsapp')
    .update({
      status: novoStatus,
      mensagem_erro: errorCode ? `Twilio error code: ${errorCode}` : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id_mensagem_provedor', messageSid)

  return new NextResponse('OK', { status: 200 })
}
