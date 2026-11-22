// Envio de e-mail com registro em logs_email e enfileiramento em email_queue
// quando falha (o cron reenvia).
//
// Nunca lança: falha de e-mail não deve desfazer a ação que a disparou.

import { db } from '@/lib/db'
import { emailQueue, logsEmail } from '@/lib/db/schema'
import { mensagemErro } from '@/lib/db/errors'
import { enviarEmail, type EmailMontado, type ResultadoEnvioEmail } from './cliente'
import type { EventoLog, TipoFila } from './fila'

export interface EnvioComFila {
  /** null quando o item da fila não deve ficar preso ao status do agendamento */
  agendamentoId: string | null
  /** Destinatários; vazio = nada a enviar (ex.: consulente antigo sem e-mail) */
  para: string[]
  email: EmailMontado
  /**
   * Evento gravado em logs_email (histórico do consulente). null = não loga,
   * como nos avisos à Casa e aos médiuns — mesmo critério do cron (eventoLogDoTipo).
   */
  evento: EventoLog | null
  /** Tipo gravado em email_queue (CHECK da tabela) */
  tipo: TipoFila
}

async function enfileirar({ agendamentoId, para, email, tipo }: EnvioComFila) {
  try {
    await db.insert(emailQueue).values({
      agendamentoId,
      destinatarios: para.join(', '),
      assunto: email.assunto,
      texto: email.texto,
      html: email.html,
      tipo,
    })
  } catch (erroFila) {
    console.error('[E-mail] Falha ao enfileirar retry:', mensagemErro(erroFila))
  }
}

/** Retorna true se o e-mail foi enviado; false se ficou na fila (ou não havia destinatário). */
export async function enviarEmailComFila(envio: EnvioComFila): Promise<boolean> {
  if (envio.para.length === 0) {
    console.warn(`[E-mail] ${envio.tipo}: sem destinatário, nada enviado`)
    return false
  }

  let resultado: ResultadoEnvioEmail
  try {
    resultado = await enviarEmail(envio.para, envio.email)
  } catch (err) {
    // Ex.: RESEND_API_KEY/EMAIL_FROM ausentes ou rede fora do ar
    console.error(`[E-mail] Falha ao enviar ${envio.tipo}:`, err)
    await enfileirar(envio)
    return false
  }

  if (envio.evento && envio.agendamentoId) {
    try {
      await db.insert(logsEmail).values({
        agendamentoId: envio.agendamentoId,
        evento: envio.evento,
        paraEmail: envio.para.join(', '),
        assunto: envio.email.assunto,
        idMensagemProvedor: resultado.idMensagem ?? null,
        status: resultado.sucesso ? 'enviado' : 'falhou',
        mensagemErro: resultado.erro ?? null,
      })
    } catch (erroLog) {
      console.error('[E-mail] Falha ao gravar log:', mensagemErro(erroLog))
    }
  }

  if (!resultado.sucesso) {
    console.error(`[E-mail] Resend recusou ${envio.tipo}:`, resultado.erro)
    await enfileirar(envio)
    return false
  }
  return true
}
