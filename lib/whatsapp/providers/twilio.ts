// Provedor Twilio — integração via SDK oficial
// Documentação: https://www.twilio.com/docs/whatsapp/api

import type { ProvedorWhatsApp, MensagemWhatsApp, ResultadoEnvio } from '../types'

interface ConfigTwilio {
  accountSid: string
  authToken: string
  fromNumber: string  // ex: +14155238886
}

export class TwilioProvider implements ProvedorWhatsApp {
  readonly nome = 'twilio'
  private config: ConfigTwilio

  constructor(config: ConfigTwilio) {
    this.config = config
  }

  async enviarMensagem({ para, corpo }: MensagemWhatsApp): Promise<ResultadoEnvio> {
    // Twilio usa autenticação HTTP Basic com Account SID e Auth Token
    const credenciais = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`
    ).toString('base64')

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`

    const corpo_form = new URLSearchParams({
      From: `whatsapp:${this.config.fromNumber}`,
      To: `whatsapp:${para}`,
      Body: corpo,
    })

    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credenciais}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: corpo_form.toString(),
      })

      const dados = await resposta.json()

      if (!resposta.ok) {
        return {
          sucesso: false,
          erro: dados.message ?? `Twilio erro HTTP ${resposta.status}`,
        }
      }

      return {
        sucesso: true,
        idMensagemProvedor: dados.sid,
      }
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido'
      return { sucesso: false, erro: mensagem }
    }
  }
}
