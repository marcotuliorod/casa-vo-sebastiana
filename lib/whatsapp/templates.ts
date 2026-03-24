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

// ─── Notificação Admin — Cancelamento ─────────────────────────

export function mensagemCancelamentoAdmin(info: InfoNovoAgendamentoAdmin): string {
  const data = parseISO(info.dataAgendada)
  const dataFormatada = format(data, "EEEE, d 'de' MMMM", { locale: ptBR })

  return [
    `❌ *Cancelamento de agendamento*`,
    ``,
    `👤 ${info.nomeCliente}`,
    `📱 ${info.telefoneCliente}`,
    ``,
    `🗓️ ${dataFormatada}`,
    `🕐 ${info.horaInicio} — ${info.horaFim}`,
  ].join('\n')
}

// ─── Notificação Médium — Atribuição ──────────────────────────

interface InfoAtribuicaoMedium {
  nomeMedium: string
  nomeCliente: string
  dataAgendada: string  // 'YYYY-MM-DD'
  horaInicio: string
  horaFim: string
}

export function mensagemAtribuicaoMedium(info: InfoAtribuicaoMedium): string {
  const data = parseISO(info.dataAgendada)
  const dataFormatada = format(data, "EEEE, d 'de' MMMM", { locale: ptBR })

  return [
    `Olá, ${info.nomeMedium}! ✨`,
    ``,
    `Você tem um novo atendimento na *Casa de Vó Sebastiana*:`,
    ``,
    `👤 ${info.nomeCliente}`,
    `🗓️ ${dataFormatada}`,
    `🕐 ${info.horaInicio} — ${info.horaFim}`,
    ``,
    `Que a energia guie seu trabalho! 🙏`,
  ].join('\n')
}

// ─── Confirmação de Inscrição em Evento ───────────────────────

interface InfoConfirmacaoEvento {
  nomeCliente: string
  tituloEvento: string
  dataEvento: string   // 'YYYY-MM-DD'
  horaInicio: string   // 'HH:MM'
  horaFim: string      // 'HH:MM'
  tokenPublico: string
  baseUrl: string
}

export function mensagemConfirmacaoEvento(info: InfoConfirmacaoEvento): string {
  const data = parseISO(info.dataEvento)
  const dataFormatada = format(data, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const linkInscricao = `${info.baseUrl}/agendamento/${info.tokenPublico}`

  return [
    `Olá, ${info.nomeCliente}! ✨`,
    ``,
    `Sua inscrição no evento da *Casa de Vó Sebastiana* foi recebida!`,
    ``,
    `🎉 *${info.tituloEvento}*`,
    `📅 ${dataFormatada}`,
    `🕐 ${info.horaInicio} — ${info.horaFim}`,
    ``,
    `Você pode acompanhar ou cancelar sua inscrição aqui:`,
    linkInscricao,
    ``,
    `Que a energia do Orixá te abençoe! 🙏`,
  ].join('\n')
}

// ─── Lembrete de Evento ───────────────────────────────────────

interface InfoLembreteEvento {
  nomeCliente: string
  tituloEvento: string
  dataEvento: string
  horaInicio: string
  tokenPublico: string
  baseUrl: string
}

export function mensagemLembreteEvento(info: InfoLembreteEvento): string {
  const linkInscricao = `${info.baseUrl}/agendamento/${info.tokenPublico}`

  return [
    `Olá, ${info.nomeCliente}! 🌟`,
    ``,
    `Lembrando que você está inscrito no evento *${info.tituloEvento}* na *Casa de Vó Sebastiana*.`,
    ``,
    `📅 ${format(parseISO(info.dataEvento), "dd/MM/yyyy", { locale: ptBR })} às ${info.horaInicio}`,
    ``,
    `Nos vemos em breve! 🌿`,
    ``,
    `Precisando cancelar:`,
    linkInscricao,
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
