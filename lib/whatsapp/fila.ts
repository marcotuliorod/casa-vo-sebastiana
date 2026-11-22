// Regras puras da fila de retry do WhatsApp (whatsapp_queue) e do agendamento
// dos lembretes. Ficam fora da rota do cron para serem testáveis sem banco.

import { formatInTimeZone } from 'date-fns-tz'
import { FUSO_HORARIO_BR } from '@/lib/utils/date'

// Itens mais antigos que isso não são mais reenviados (mensagem perdeu o sentido)
export const VALIDADE_FILA_HORAS = 48

// Hora (Brasília) a partir da qual os lembretes de horário do dia seguinte saem.
// O cron roda de hora em hora; a flag lembrete_enviado garante um envio só.
export const HORA_LEMBRETES_HORARIO = 9

// Espera até a próxima tentativa, por número de tentativas já feitas.
// Margem de 5 min para cair no ciclo horário seguinte do cron.
const ESPERA_RETRY_MINUTOS = [55, 115, 235]

export type TipoFila = 'confirmacao' | 'lembrete_24h' | 'cancelamento' | 'admin'
export type EventoLog = 'confirmacao_agendamento' | 'lembrete_24h' | 'cancelamento'

export interface ItemFilaParaAvaliar {
  tipo: string
  criadoEm: Date
  agendamento: { status: string; dataAgendada: string } | null
}

/** Motivo para descartar o item sem enviar, ou null se ainda deve ser enviado. */
export function motivoDescarte(item: ItemFilaParaAvaliar, agora: Date): string | null {
  const idadeHoras = (agora.getTime() - item.criadoEm.getTime()) / 3_600_000
  if (idadeHoras > VALIDADE_FILA_HORAS) return `expirada (mais de ${VALIDADE_FILA_HORAS}h na fila)`

  const ag = item.agendamento
  if (!ag || item.tipo === 'cancelamento') return null

  if (ag.status === 'cancelado') return 'agendamento cancelado'

  const hojeBR = formatInTimeZone(agora, FUSO_HORARIO_BR, 'yyyy-MM-dd')
  if (ag.dataAgendada < hojeBR) return 'agendamento já passou'

  return null
}

/** Próxima tentativa após `tentativasFeitas` envios com falha. */
export function proximoRetry(tentativasFeitas: number, agora: Date): Date {
  const minutos = ESPERA_RETRY_MINUTOS[tentativasFeitas - 1] ?? ESPERA_RETRY_MINUTOS.at(-1)!
  return new Date(agora.getTime() + minutos * 60_000)
}

/** Lembretes de horário só saem a partir das 09:00 de Brasília. */
export function horaDeLembretesHorario(agora: Date): boolean {
  return Number(formatInTimeZone(agora, FUSO_HORARIO_BR, 'H')) >= HORA_LEMBRETES_HORARIO
}

/** Evento de logs_whatsapp correspondente ao tipo da fila (admin não é logado). */
export function eventoLogDoTipo(tipo: string): EventoLog | null {
  switch (tipo) {
    case 'confirmacao':
      return 'confirmacao_agendamento'
    case 'lembrete_24h':
      return 'lembrete_24h'
    case 'cancelamento':
      return 'cancelamento'
    default:
      return null
  }
}
