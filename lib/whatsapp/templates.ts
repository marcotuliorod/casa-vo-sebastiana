// Templates de mensagens WhatsApp — Casa de Vó Sebastiana
// Usando formatação do WhatsApp: *negrito*, _itálico_

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface InfoAgendamento {
  nomeCliente: string
  dataAgendada: string  // 'YYYY-MM-DD'
  horaInicio: string    // 'HH:MM'
  tokenPublico: string
  baseUrl: string
}

// ─── Confirmação de Agendamento ───────────────────────────────

export function mensagemConfirmacao(info: InfoAgendamento): string {
  const data = parseISO(info.dataAgendada)
  const dataFormatada = format(data, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const linkAgendamento = `${info.baseUrl}/agendamento/${info.tokenPublico}`

  return [
    `Olá, ${info.nomeCliente}! ✨`,
    ``,
    `Seu atendimento na *Casa de Vó Sebastiana* está confirmado.`,
    ``,
    `📅 ${dataFormatada}`,
    `🕐 ${info.horaInicio}`,
    ``,
    `Você pode ver ou cancelar seu agendamento aqui:`,
    linkAgendamento,
    ``,
    `Que a energia do Orixá te abençoe! 🙏`,
  ].join('\n')
}

// ─── Lembrete 24h Antes ───────────────────────────────────────

export function mensagemLembrete24h(info: InfoAgendamento): string {
  const linkAgendamento = `${info.baseUrl}/agendamento/${info.tokenPublico}`

  return [
    `Olá, ${info.nomeCliente}! 🌟`,
    ``,
    `Lembrando que seu atendimento na *Casa de Vó Sebastiana* é *amanhã* às ${info.horaInicio}.`,
    ``,
    `Nos vemos em breve! 🌿`,
    ``,
    `Precisando cancelar:`,
    linkAgendamento,
  ].join('\n')
}

// ─── Notificação Admin — Novo Agendamento ─────────────────────

interface InfoNovoAgendamentoAdmin {
  nomeCliente: string
  telefoneCliente: string
  dataAgendada: string  // 'YYYY-MM-DD'
  horaInicio: string
  horaFim: string
}

export function mensagemNovoAgendamentoAdmin(info: InfoNovoAgendamentoAdmin): string {
  const data = parseISO(info.dataAgendada)
  const dataFormatada = format(data, "EEEE, d 'de' MMMM", { locale: ptBR })

  return [
    `📅 *Novo agendamento*`,
    ``,
    `👤 ${info.nomeCliente}`,
    `📱 ${info.telefoneCliente}`,
    ``,
    `🗓️ ${dataFormatada}`,
    `🕐 ${info.horaInicio} — ${info.horaFim}`,
  ].join('\n')
}

// ─── Cancelamento ─────────────────────────────────────────────

export function mensagemCancelamento(info: InfoAgendamento): string {
  const linkNovoAgendamento = `${info.baseUrl}/agendar`

  return [
    `Olá, ${info.nomeCliente}.`,
    ``,
    `Seu agendamento na *Casa de Vó Sebastiana* foi cancelado.`,
    ``,
    `Quando quiser reagendar, estamos aqui:`,
    linkNovoAgendamento,
    ``,
    `Que a luz guie seus caminhos. 🕯️`,
  ].join('\n')
}
