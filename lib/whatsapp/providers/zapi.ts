// Provedor Z-API — integração via REST
// Documentação: https://developer.z-api.io/

import type { ProvedorWhatsApp, MensagemWhatsApp, ResultadoEnvio } from '../types'

interface ConfigZApi {
  instanceId: string
  instanceToken: string
  clientToken: string
}

export class ZApiProvider implements ProvedorWhatsApp {
  readonly nome = 'zapi'
  private baseUrl: string
  private clientToken: string

  constructor(config: ConfigZApi) {
    this.baseUrl = `https://api.z-api.io/instances/${config.instanceId}/token/${config.instanceToken}`
    this.clientToken = config.clientToken
  }

  async enviarMensagem({ para, corpo }: MensagemWhatsApp): Promise<ResultadoEnvio> {
    // Z-API espera número sem '+': '5511999999999'
    const telefone = para.replace(/^\+/, '')

    try {
      const resposta = await fetch(`${this.baseUrl}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: telefone,
          message: corpo,
        }),
      })

      const dados = await resposta.json()

      if (!resposta.ok) {
        return {
          sucesso: false,
          erro: dados.message ?? `Z-API erro HTTP ${resposta.status}`,
        }
      }

      return {
        sucesso: true,
        idMensagemProvedor: dados.zaapId ?? dados.messageId,
      }
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido'
      return { sucesso: false, erro: mensagem }
    }
  }
}
