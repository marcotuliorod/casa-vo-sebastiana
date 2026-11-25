// Templates dos e-mails — Casa de Vó Sebastiana
// Cada template devolve assunto + texto puro + HTML (com os dados escapados).

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { EmailMontado } from './cliente'

const NOME_CASA = 'Casa de Vó Sebastiana'
const COR_BOTAO = '#4A86C8'

function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function dataExtenso(data: string, comAno = true): string {
  const padrao = comAno ? "EEEE, d 'de' MMMM 'de' yyyy" : "EEEE, d 'de' MMMM"
  return format(parseISO(data), padrao, { locale: ptBR })
}

interface PartesEmail {
  assunto: string
  saudacao: string
  paragrafos: string[]
  detalhes?: Array<[rotulo: string, valor: string]>
  botao?: { texto: string; url: string }
  despedida?: string
}

/** Monta texto e HTML a partir das mesmas partes, para os dois saírem iguais. */
export function montarEmail(p: PartesEmail): EmailMontado {
  const detalhes = p.detalhes ?? []

  const texto = [
    p.saudacao,
    '',
    ...p.paragrafos.flatMap((par) => [par, '']),
    ...(detalhes.length ? [...detalhes.map(([r, v]) => `${r}: ${v}`), ''] : []),
    ...(p.botao ? [`${p.botao.texto}: ${p.botao.url}`, ''] : []),
    ...(p.despedida ? [p.despedida, ''] : []),
    NOME_CASA,
  ].join('\n')

  const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
  <p style="margin:0 0 16px">${escapeHtml(p.saudacao)}</p>
${p.paragrafos.map((par) => `  <p style="margin:0 0 16px">${escapeHtml(par)}</p>`).join('\n')}
${
  detalhes.length
    ? `  <table style="margin:0 0 16px;border-collapse:collapse">
${detalhes
  .map(
    ([r, v]) =>
      `    <tr><td style="padding:2px 12px 2px 0;color:#6b7280">${escapeHtml(r)}</td><td style="padding:2px 0"><strong>${escapeHtml(v)}</strong></td></tr>`
  )
  .join('\n')}
  </table>`
    : ''
}
${
  p.botao
    ? `  <p style="margin:24px 0"><a href="${escapeHtml(p.botao.url)}" style="background:${COR_BOTAO};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(p.botao.texto)}</a></p>`
    : ''
}
${p.despedida ? `  <p style="margin:0 0 16px">${escapeHtml(p.despedida)}</p>` : ''}
  <p style="margin:24px 0 0;color:#6b7280;font-size:13px">${NOME_CASA}</p>
</div>`

  return { assunto: p.assunto, texto, html }
}

// ─── Consulente ───────────────────────────────────────────────

interface InfoAgendamento {
  nomeCliente: string
  dataAgendada: string // 'YYYY-MM-DD'
  horaInicio: string // 'HH:MM'
  tokenPublico: string
  baseUrl: string
}

export function emailConfirmacao(info: InfoAgendamento): EmailMontado {
  return montarEmail({
    assunto: `Agendamento recebido — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [`Seu agendamento na ${NOME_CASA} foi recebido.`],
    detalhes: [
      ['Data', dataExtenso(info.dataAgendada)],
      ['Horário', info.horaInicio],
    ],
    botao: { texto: 'Ver ou cancelar agendamento', url: `${info.baseUrl}/agendamento/${info.tokenPublico}` },
    despedida: 'Que a energia do Orixá te abençoe!',
  })
}

export function emailLembrete24h(info: InfoAgendamento): EmailMontado {
  return montarEmail({
    assunto: `Lembrete: seu atendimento é amanhã — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [`Lembrando que seu atendimento na ${NOME_CASA} é amanhã.`],
    detalhes: [
      ['Data', dataExtenso(info.dataAgendada)],
      ['Horário', info.horaInicio],
    ],
    botao: { texto: 'Precisa cancelar? Clique aqui', url: `${info.baseUrl}/agendamento/${info.tokenPublico}` },
    despedida: 'Nos vemos em breve!',
  })
}

export function emailCancelamento(info: InfoAgendamento): EmailMontado {
  return montarEmail({
    assunto: `Agendamento cancelado — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}.`,
    paragrafos: [
      `Seu agendamento na ${NOME_CASA} para ${dataExtenso(info.dataAgendada)} às ${info.horaInicio} foi cancelado.`,
      'Quando quiser reagendar, estamos aqui.',
    ],
    botao: { texto: 'Fazer novo agendamento', url: `${info.baseUrl}/agendar` },
    despedida: 'Que a luz guie seus caminhos.',
  })
}

export function emailLinkHistorico(info: { nomeCliente: string; url: string }): EmailMontado {
  return montarEmail({
    assunto: `Seus agendamentos — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [
      'Recebemos um pedido para ver o histórico dos seus agendamentos.',
      'O link abaixo vale por 1 hora. Se não foi você quem pediu, pode ignorar este e-mail.',
    ],
    botao: { texto: 'Ver meus agendamentos', url: info.url },
  })
}

interface InfoEvento {
  nomeCliente: string
  tituloEvento: string
  dataEvento: string // 'YYYY-MM-DD'
  horaInicio: string // 'HH:MM'
  horaFim?: string // 'HH:MM'
  tokenPublico: string
  baseUrl: string
}

function horarioEvento(info: InfoEvento): string {
  return info.horaFim ? `${info.horaInicio} — ${info.horaFim}` : info.horaInicio
}

export function emailConfirmacaoEvento(info: InfoEvento): EmailMontado {
  return montarEmail({
    assunto: `Inscrição recebida: ${info.tituloEvento} — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [`Sua inscrição no evento da ${NOME_CASA} foi recebida.`],
    detalhes: [
      ['Evento', info.tituloEvento],
      ['Data', dataExtenso(info.dataEvento)],
      ['Horário', horarioEvento(info)],
    ],
    botao: { texto: 'Ver ou cancelar inscrição', url: `${info.baseUrl}/agendamento/${info.tokenPublico}` },
    despedida: 'Que a energia do Orixá te abençoe!',
  })
}

export function emailLembreteEvento(info: InfoEvento): EmailMontado {
  return montarEmail({
    assunto: `Lembrete: ${info.tituloEvento} — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [`Lembrando que você está inscrito no evento ${info.tituloEvento} na ${NOME_CASA}.`],
    detalhes: [
      ['Data', dataExtenso(info.dataEvento)],
      ['Horário', horarioEvento(info)],
    ],
    botao: { texto: 'Precisa cancelar? Clique aqui', url: `${info.baseUrl}/agendamento/${info.tokenPublico}` },
    despedida: 'Nos vemos em breve!',
  })
}

// ─── Casa (admin) ─────────────────────────────────────────────

interface InfoAvisoAdmin {
  nomeCliente: string
  telefoneCliente: string
  emailCliente?: string | null
  dataAgendada: string // 'YYYY-MM-DD'
  horaInicio: string
  horaFim: string
  tituloEvento?: string
}

function detalhesAdmin(info: InfoAvisoAdmin): Array<[string, string]> {
  return [
    ...(info.tituloEvento ? ([['Evento', info.tituloEvento]] as Array<[string, string]>) : []),
    ['Consulente', info.nomeCliente],
    ['Telefone', info.telefoneCliente],
    ...(info.emailCliente ? ([['E-mail', info.emailCliente]] as Array<[string, string]>) : []),
    ['Data', dataExtenso(info.dataAgendada, false)],
    ['Horário', `${info.horaInicio} — ${info.horaFim}`],
  ]
}

export function emailNovoAgendamentoAdmin(info: InfoAvisoAdmin): EmailMontado {
  const oque = info.tituloEvento ? 'Nova inscrição em evento' : 'Novo agendamento'
  return montarEmail({
    assunto: `${oque}: ${info.nomeCliente} em ${format(parseISO(info.dataAgendada), 'dd/MM')}`,
    saudacao: `${oque} pelo site.`,
    paragrafos: [],
    detalhes: detalhesAdmin(info),
  })
}

export function emailCancelamentoAdmin(info: InfoAvisoAdmin): EmailMontado {
  return montarEmail({
    assunto: `Cancelamento: ${info.nomeCliente} em ${format(parseISO(info.dataAgendada), 'dd/MM')}`,
    saudacao: 'Um agendamento foi cancelado pelo consulente.',
    paragrafos: [],
    detalhes: detalhesAdmin(info),
  })
}

// ─── Médium ───────────────────────────────────────────────────

interface InfoAtribuicaoMedium {
  nomeMedium: string
  nomeCliente: string
  dataAgendada: string // 'YYYY-MM-DD'
  horaInicio: string
  horaFim: string
}

export function emailAtribuicaoMedium(info: InfoAtribuicaoMedium): EmailMontado {
  return montarEmail({
    assunto: `Novo atendimento em ${format(parseISO(info.dataAgendada), 'dd/MM')} — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeMedium}!`,
    paragrafos: [`Você tem um novo atendimento na ${NOME_CASA}.`],
    detalhes: [
      ['Consulente', info.nomeCliente],
      ['Data', dataExtenso(info.dataAgendada, false)],
      ['Horário', `${info.horaInicio} — ${info.horaFim}`],
    ],
    despedida: 'Que a energia guie seu trabalho!',
  })
}
