// Envio de WhatsApp para o consulente com registro em logs_whatsapp e
// enfileiramento em whatsapp_queue quando falha (US-16).
//
// Nunca lança: falha de WhatsApp não deve desfazer a ação que a disparou.

import { db } from '@/lib/db'
import { logsWhatsapp, whatsappQueue } from '@/lib/db/schema'
import { mensagemErro } from '@/lib/db/errors'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'

type EventoLog = (typeof logsWhatsapp.$inferInsert)['evento']
export type TipoFila = 'confirmacao' | 'lembrete_24h' | 'cancelamento' | 'admin'

export interface EnvioComFila {
  /** null quando o item da fila não deve ficar preso ao status do agendamento */
  agendamentoId: string | null
  telefone: string
  mensagem: string
  /**
   * Evento gravado em logs_whatsapp (histórico do consulente). null = não loga,
   * como nas notificações ao admin — mesmo critério do cron (eventoLogDoTipo).
   */
  evento: EventoLog | null
  /** Tipo gravado em whatsapp_queue (CHECK da tabela) */
  tipo: TipoFila
}

async function enfileirar({ agendamentoId, telefone, mensagem, tipo }: EnvioComFila) {
  try {
    await db.insert(whatsappQueue).values({ agendamentoId, telefone, mensagem, tipo })
  } catch (erroFila) {
    console.error('[WhatsApp] Falha ao enfileirar retry:', mensagemErro(erroFila))
  }
}

/** Retorna true se a mensagem foi enviada; false se ficou na fila para retry. */
export async function enviarWhatsAppComFila(envio: EnvioComFila): Promise<boolean> {
  let provedor
  let resultado
  try {
    provedor = getProvedorWhatsApp()
    resultado = await provedor.enviarMensagem({ para: envio.telefone, corpo: envio.mensagem })
  } catch (err) {
    // Ex.: credenciais ausentes ou provedor fora do ar
    console.error(`[WhatsApp] Falha ao enviar ${envio.tipo}:`, err)
    await enfileirar(envio)
    return false
  }

  if (envio.evento && envio.agendamentoId) {
    try {
      await db.insert(logsWhatsapp).values({
        agendamentoId: envio.agendamentoId,
        evento: envio.evento,
        provedor: provedor.nome,
        paraTelefone: envio.telefone,
        mensagem: envio.mensagem,
        idMensagemProvedor: resultado.idMensagemProvedor ?? null,
        status: resultado.sucesso ? 'enviado' : 'falhou',
        mensagemErro: resultado.erro ?? null,
      })
    } catch (erroLog) {
      console.error('[WhatsApp] Falha ao gravar log:', mensagemErro(erroLog))
    }
  }

  if (!resultado.sucesso) {
    console.error(`[WhatsApp] Provedor recusou ${envio.tipo}:`, resultado.erro)
    await enfileirar(envio)
    return false
  }
  return true
}
