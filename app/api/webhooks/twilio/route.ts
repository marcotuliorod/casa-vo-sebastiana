// Webhook de status do Twilio WhatsApp
// Configurar URL no painel Twilio: Messaging → Status Callback URL

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logsWhatsapp } from '@/lib/db/schema'

const mapearStatus = (status: string): 'na_fila' | 'enviado' | 'entregue' | 'falhou' => {
  const mapa: Record<string, 'na_fila' | 'enviado' | 'entregue' | 'falhou'> = {
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

  // Validar assinatura Twilio (HMAC-SHA1) — segurança contra requisições forjadas
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (authToken) {
    const twilioSignature = request.headers.get('x-twilio-signature') ?? ''
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio`
    const params: Record<string, string> = {}
    formData.forEach((value, key) => { params[key] = value.toString() })

    if (!twilio.validateRequest(authToken, twilioSignature, webhookUrl, params)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  const messageSid = formData.get('MessageSid') as string | null
  const messageStatus = formData.get('MessageStatus') as string | null
  const errorCode = formData.get('ErrorCode') as string | null

  if (!messageSid || !messageStatus) {
    return new NextResponse('OK', { status: 200 })
  }

  const novoStatus = mapearStatus(messageStatus)

  await db
    .update(logsWhatsapp)
    .set({
      status: novoStatus,
      mensagemErro: errorCode ? `Twilio error code: ${errorCode}` : null,
      atualizadoEm: new Date(),
    })
    .where(eq(logsWhatsapp.idMensagemProvedor, messageSid))

  return new NextResponse('OK', { status: 200 })
}
