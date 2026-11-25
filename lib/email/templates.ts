// Templates dos e-mails — Casa de Vó Sebastiana
// Cada template devolve assunto + texto puro + HTML (com os dados escapados).

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { EmailMontado } from './cliente'
import type { InfoCasa } from '@/lib/queries/casa'

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
  /** Parágrafos depois dos detalhes (ex.: orientações da Casa) */
  observacoes?: string[]
  botao?: { texto: string; url: string }
  despedida?: string
}

/** Endereço, mapa e orientações da Casa (tela /admin/casa); o que estiver vazio fica de fora. */
function blocoCasa(
  casa: InfoCasa | undefined,
  { orientacoes = true, politica = false }: { orientacoes?: boolean; politica?: boolean } = {}
): { detalhes: Array<[string, string]>; observacoes: string[] } {
  if (!casa) return { detalhes: [], observacoes: [] }
  const detalhes: Array<[string, string]> = []
  if (casa.endereco) detalhes.push(['Endereço', casa.endereco])
  if (casa.linkMapa) detalhes.push(['Mapa', casa.linkMapa])
  const contato = [casa.emailContato, casa.telefoneContato].filter(Boolean).join(' · ')
  if (contato) detalhes.push(['Contato', contato])
  const observacoes: string[] = []
  if (orientacoes && casa.orientacoes) observacoes.push(casa.orientacoes)
  if (politica && casa.politicaCancelamento) observacoes.push(casa.politicaCancelamento)
  return { detalhes, observacoes }
}

/** Monta texto e HTML a partir das mesmas partes, para os dois saírem iguais. */
export function montarEmail(p: PartesEmail): EmailMontado {
  const detalhes = p.detalhes ?? []
  const observacoes = p.observacoes ?? []

  const texto = [
    p.saudacao,
    '',
    ...p.paragrafos.flatMap((par) => [par, '']),
    ...(detalhes.length ? [...detalhes.map(([r, v]) => `${r}: ${v}`), ''] : []),
    ...observacoes.flatMap((par) => [par, '']),
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
      `    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;vertical-align:top">${escapeHtml(r)}</td><td style="padding:2px 0">${
        /^https:\/\/\S+$/.test(v)
          ? `<a href="${escapeHtml(v)}" style="color:${COR_BOTAO}">Abrir no mapa</a>`
          : `<strong>${escapeHtml(v)}</strong>`
      }</td></tr>`
  )
  .join('\n')}
  </table>`
    : ''
}
${observacoes.map((par) => `  <p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(par)}</p>`).join('\n')}
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
  horaFim?: string // 'HH:MM'
  tokenPublico: string
  baseUrl: string
  casa?: InfoCasa
}

function horario(info: { horaInicio: string; horaFim?: string }): string {
  return info.horaFim ? `${info.horaInicio} às ${info.horaFim}` : info.horaInicio
}

function linkAgendamento(info: InfoAgendamento): string {
  return `${info.baseUrl}/agendamento/${info.tokenPublico}`
}

export function emailConfirmacao(info: InfoAgendamento): EmailMontado {
  const casa = blocoCasa(info.casa, {})
  return montarEmail({
    assunto: `Agendamento recebido — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [
      `Recebemos seu pedido de agendamento na ${NOME_CASA}.`,
      'Ele ainda precisa ser confirmado pela Casa. Você vai receber outro e-mail assim que for confirmado.',
    ],
    detalhes: [
      ['Data', dataExtenso(info.dataAgendada)],
      ['Horário', horario(info)],
      ...casa.detalhes,
    ],
    observacoes: casa.observacoes,
    botao: { texto: 'Ver ou cancelar agendamento', url: linkAgendamento(info) },
    despedida: 'Que a energia do Orixá abençoe você!',
  })
}

export function emailAgendamentoConfirmado(info: InfoAgendamento & { tituloEvento?: string }): EmailMontado {
  const oque = info.tituloEvento ? `Sua inscrição em ${info.tituloEvento}` : 'Seu atendimento'
  const casa = blocoCasa(info.casa, { politica: true })
  return montarEmail({
    assunto: info.tituloEvento
      ? `Inscrição confirmada: ${info.tituloEvento} — ${NOME_CASA}`
      : `Agendamento confirmado — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [
      `${oque} na ${NOME_CASA} está confirmado.`,
      'Você vai receber um lembrete antes da data.',
    ],
    detalhes: [
      ...(info.tituloEvento ? ([['Evento', info.tituloEvento]] as Array<[string, string]>) : []),
      ['Data', dataExtenso(info.dataAgendada)],
      ['Horário', horario(info)],
      ...casa.detalhes,
    ],
    observacoes: casa.observacoes,
    botao: { texto: 'Ver ou cancelar', url: linkAgendamento(info) },
    despedida: 'Que a energia do Orixá abençoe você!',
  })
}

export function emailAgendamentoAlterado(
  info: InfoAgendamento & { dataAnterior: string; horaAnterior: string }
): EmailMontado {
  const casa = blocoCasa(info.casa, { orientacoes: false })
  return montarEmail({
    assunto: `Seu agendamento mudou de data ou horário — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [
      `A ${NOME_CASA} alterou seu agendamento, que era em ${dataExtenso(info.dataAnterior, false)} às ${info.horaAnterior}.`,
      'Confira a nova data e o novo horário abaixo. Se não puder comparecer, cancele pelo botão.',
    ],
    detalhes: [
      ['Nova data', dataExtenso(info.dataAgendada)],
      ['Novo horário', horario(info)],
      ...casa.detalhes,
    ],
    observacoes: casa.observacoes,
    botao: { texto: 'Ver ou cancelar agendamento', url: linkAgendamento(info) },
  })
}

export function emailLembrete24h(info: InfoAgendamento): EmailMontado {
  const casa = blocoCasa(info.casa, {})
  return montarEmail({
    assunto: `Lembrete: seu atendimento é amanhã — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [`Lembrando que seu atendimento na ${NOME_CASA} é amanhã.`],
    detalhes: [
      ['Data', dataExtenso(info.dataAgendada)],
      ['Horário', horario(info)],
      ...casa.detalhes,
    ],
    observacoes: casa.observacoes,
    botao: { texto: 'Ver ou cancelar agendamento', url: linkAgendamento(info) },
    despedida: 'Nos vemos em breve!',
  })
}

export function emailCancelamento(info: InfoAgendamento & { motivo?: string | null }): EmailMontado {
  return montarEmail({
    assunto: `Agendamento cancelado — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}.`,
    paragrafos: [
      `Seu agendamento na ${NOME_CASA} para ${dataExtenso(info.dataAgendada)} às ${info.horaInicio} foi cancelado.`,
      ...(info.motivo ? [`Motivo: ${info.motivo}`] : []),
      'Quando quiser agendar de novo, estamos aqui.',
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
  casa?: InfoCasa
}

function horarioEvento(info: InfoEvento): string {
  return horario(info)
}

export function emailConfirmacaoEvento(info: InfoEvento): EmailMontado {
  const casa = blocoCasa(info.casa, { orientacoes: false })
  return montarEmail({
    assunto: `Inscrição recebida: ${info.tituloEvento} — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [
      `Recebemos sua inscrição no evento da ${NOME_CASA}.`,
      'Ela ainda precisa ser confirmada pela Casa. Você vai receber outro e-mail assim que for confirmada.',
    ],
    detalhes: [
      ['Evento', info.tituloEvento],
      ['Data', dataExtenso(info.dataEvento)],
      ['Horário', horarioEvento(info)],
      ...casa.detalhes,
    ],
    observacoes: casa.observacoes,
    botao: { texto: 'Ver ou cancelar inscrição', url: `${info.baseUrl}/agendamento/${info.tokenPublico}` },
    despedida: 'Que a energia do Orixá abençoe você!',
  })
}

export function emailLembreteEvento(info: InfoEvento): EmailMontado {
  const casa = blocoCasa(info.casa, { orientacoes: false })
  return montarEmail({
    assunto: `Lembrete: ${info.tituloEvento} — ${NOME_CASA}`,
    saudacao: `Olá, ${info.nomeCliente}!`,
    paragrafos: [`Lembrando que você está inscrito no evento ${info.tituloEvento} na ${NOME_CASA}.`],
    detalhes: [
      ['Data', dataExtenso(info.dataEvento)],
      ['Horário', horarioEvento(info)],
      ...casa.detalhes,
    ],
    observacoes: casa.observacoes,
    botao: { texto: 'Ver ou cancelar inscrição', url: `${info.baseUrl}/agendamento/${info.tokenPublico}` },
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
