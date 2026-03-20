// Factory: lê WHATSAPP_PROVIDER do .env e retorna o provedor correto
// Trocar de Z-API para Twilio: alterar WHATSAPP_PROVIDER=twilio no .env

import type { ProvedorWhatsApp } from './types'
import { ZApiProvider } from './providers/zapi'
import { TwilioProvider } from './providers/twilio'

export function getProvedorWhatsApp(): ProvedorWhatsApp {
  const provedor = process.env.WHATSAPP_PROVIDER

  if (provedor === 'zapi') {
    const instanceId = process.env.ZAPI_INSTANCE_ID
    const instanceToken = process.env.ZAPI_INSTANCE_TOKEN
    const clientToken = process.env.ZAPI_CLIENT_TOKEN

    if (!instanceId || !instanceToken || !clientToken) {
      throw new Error(
        'Z-API: configure ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN no .env'
      )
    }

    return new ZApiProvider({ instanceId, instanceToken, clientToken })
  }

  if (provedor === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        'Twilio: configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_FROM no .env'
      )
    }

    return new TwilioProvider({ accountSid, authToken, fromNumber })
  }

  throw new Error(
    `WHATSAPP_PROVIDER inválido: "${provedor}". Use "zapi" ou "twilio".`
  )
}
