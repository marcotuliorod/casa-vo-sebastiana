// Interface do Strategy Pattern para provedores de WhatsApp

export interface ResultadoEnvio {
  sucesso: boolean
  idMensagemProvedor?: string
  erro?: string
}

export interface MensagemWhatsApp {
  para: string  // Número E.164: +5511999999999
  corpo: string
}

export interface ProvedorWhatsApp {
  readonly nome: string
  enviarMensagem(mensagem: MensagemWhatsApp): Promise<ResultadoEnvio>
}
