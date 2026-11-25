// Cron job (de hora em hora): lembretes de horário (a partir das 09:00 BRT),
// lembretes de eventos e reenvio da fila email_queue.
// Disparado pelo container `cron` do Docker Compose (ver docker/cron/)

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, isNotNull, lt, lte, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, emailQueue, logsEmail } from '@/lib/db/schema'
import { getAgendamentosParaLembrete } from '@/lib/queries/appointments'
import { emailConfigurado, enviarEmail, listaDeEmails, type EmailMontado } from '@/lib/email/cliente'
import { emailLembrete24h, emailLembreteEvento } from '@/lib/email/templates'
import { amanha } from '@/lib/utils/date'
import { getInfoCasa } from '@/lib/queries/casa'
import { apagarClienteComHistorico, idsCadastrosVencidos } from '@/lib/db/clientes'
import { timingSafeEqual } from 'node:crypto'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { addHours } from 'date-fns'
import {
  RETENCAO_REGISTROS_EMAIL_DIAS,
  eventoLogDoTipo,
  horaDeLembretesHorario,
  motivoDescarte,
  proximoRetry,
} from '@/lib/email/fila'

/** Envia um lembrete, grava o log e marca o agendamento. Retorna true se enviou. */
async function enviarLembrete(agendamentoId: string, para: string, email: EmailMontado): Promise<boolean> {
  let resultado
  try {
    resultado = await enviarEmail([para], email)
  } catch (err) {
    console.error('[Cron lembretes] Falha ao enviar lembrete:', err instanceof Error ? err.message : err)
    return false
  }

  await db.insert(logsEmail).values({
    agendamentoId,
    evento: 'lembrete_24h',
    paraEmail: para,
    assunto: email.assunto,
    idMensagemProvedor: resultado.idMensagem ?? null,
    status: resultado.sucesso ? 'enviado' : 'falhou',
    mensagemErro: resultado.erro ?? null,
  })

  if (!resultado.sucesso) {
    console.error('[Cron lembretes] Resend recusou lembrete:', resultado.erro)
    return false
  }

  // Idempotência: não reenviar no próximo ciclo
  await db.update(agendamentos).set({ lembreteEnviado: true }).where(eq(agendamentos.id, agendamentoId))
  return true
}

/** Compara o cabeçalho com o esperado em tempo constante (não vaza o segredo pelo tempo de resposta). */
function segredoConfere(recebido: string | null, esperado: string): boolean {
  const a = Buffer.from(recebido ?? '')
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  // Verificar autorização do cron
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron lembretes] CRON_SECRET não configurado')
    return NextResponse.json({ erro: 'Configuração inválida' }, { status: 500 })
  }

  if (cronSecret.length < 32) {
    console.error('[Cron lembretes] CRON_SECRET muito curto (mínimo 32 caracteres)')
    return NextResponse.json({ erro: 'Configuração inválida' }, { status: 500 })
  }

  if (!segredoConfere(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const infoCasa = await getInfoCasa()
  const dataAmanha = amanha()
  const agoraCron = new Date()

  // Sem RESEND_API_KEY/EMAIL_FROM nada é enviado e nada é marcado:
  // lembretes e fila ficam para o próximo ciclo (o descarte da fila continua valendo).
  const emailDisponivel = emailConfigurado()
  if (!emailDisponivel) {
    console.error('[Cron lembretes] E-mail não configurado (RESEND_API_KEY/EMAIL_FROM) — envios adiados')
  }

  // O cron roda de hora em hora. Lembretes de horário só a partir das 09:00 BRT;
  // eventos e fila de retry rodam sempre.
  const rodarLembretesHorario = horaDeLembretesHorario(agoraCron)

  // Buscar agendamentos confirmados de amanhã sem lembrete enviado
  let agendamentosLembrete: Awaited<ReturnType<typeof getAgendamentosParaLembrete>> = []
  if (rodarLembretesHorario) {
    try {
      agendamentosLembrete = await getAgendamentosParaLembrete(dataAmanha)
    } catch (erro) {
      console.error('[Cron lembretes] Erro na query:', erro)
      return NextResponse.json({ erro: erro instanceof Error ? erro.message : 'Erro desconhecido' }, { status: 500 })
    }
  }

  let processados = 0
  let falhas = 0
  let semEmail = 0

  if (emailDisponivel) for (const ag of agendamentosLembrete) {
    // Consulentes antigos (da época do WhatsApp) podem não ter e-mail
    if (!ag.clientes.email) {
      semEmail++
      continue
    }

    const email = emailLembrete24h({
      nomeCliente: ag.clientes.nome,
      dataAgendada: ag.data_agendada,
      horaInicio: ag.hora_inicio.slice(0, 5),
      horaFim: ag.hora_fim.slice(0, 5),
      tokenPublico: ag.token_publico,
      baseUrl,
      casa: infoCasa,
    })

    if (await enviarLembrete(ag.id, ag.clientes.email, email)) processados++
    else falhas++
  }

  // ─── Lembretes de Eventos (lembrete_horas por evento) ────────────────────────

  let eventosProcessados = 0
  let eventosFalhas = 0

  // Busca agendamentos de eventos confirmados sem lembrete, ordenando por data/hora
  const agEventos = await db.query.agendamentos.findMany({
    where: and(
      isNotNull(agendamentos.eventoId),
      eq(agendamentos.status, 'confirmado'),
      eq(agendamentos.lembreteEnviado, false),
      gte(agendamentos.dataAgendada, formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd'))
    ),
    with: {
      cliente: true,
      evento: { columns: { titulo: true, horaInicio: true, lembreteHoras: true } },
    },
  })

  if (agEventos.length && emailDisponivel) {
    const agora = new Date()

    for (const ag of agEventos) {
      const evento = ag.evento
      if (!evento) continue
      if (!ag.cliente.email) {
        semEmail++
        continue
      }

      // Calcula quando deve enviar: data_agendada + hora_inicio - lembrete_horas.
      // A data e a hora estão no horário de Brasília; o container roda em UTC.
      const dataHoraEvento = fromZonedTime(`${ag.dataAgendada}T${ag.horaInicio}`, 'America/Sao_Paulo')
      const momentoLembrete = addHours(dataHoraEvento, -evento.lembreteHoras)

      // Só envia se já passou do momento do lembrete (e ainda não passou o evento)
      if (agora < momentoLembrete || agora > dataHoraEvento) continue

      const email = emailLembreteEvento({
        nomeCliente: ag.cliente.nome,
        tituloEvento: evento.titulo,
        dataEvento: ag.dataAgendada,
        horaInicio: ag.horaInicio.slice(0, 5),
        horaFim: ag.horaFim.slice(0, 5),
        tokenPublico: ag.tokenPublico,
        baseUrl,
        casa: infoCasa,
      })

      if (await enviarLembrete(ag.id, ag.cliente.email, email)) eventosProcessados++
      else eventosFalhas++
    }
  }

  // US-16: Processar fila de retry de e-mails com falha
  let retryProcessados = 0
  let retryFalhas = 0
  let retryDescartados = 0

  const agora = new Date()
  const fila = await db
    .select({
      item: emailQueue,
      agStatus: agendamentos.status,
      agData: agendamentos.dataAgendada,
    })
    .from(emailQueue)
    .leftJoin(agendamentos, eq(emailQueue.agendamentoId, agendamentos.id))
    .where(
      and(
        eq(emailQueue.status, 'pendente'),
        lte(emailQueue.proximoRetry, agora),
        lt(emailQueue.tentativas, emailQueue.maxTentativas)
      )
    )

  for (const { item, agStatus, agData } of fila) {
    // Descarta e-mails que perderam o sentido (antigos, de agendamento cancelado
    // ou já passado) — mesmo sem e-mail configurado, para não acumular envios atrasados.
    const motivo = motivoDescarte(
      {
        tipo: item.tipo,
        criadoEm: item.criadoEm,
        agendamento: agStatus && agData ? { status: agStatus, dataAgendada: agData } : null,
      },
      agora
    )
    if (motivo) {
      await db.update(emailQueue).set({ status: 'falhou' }).where(eq(emailQueue.id, item.id))
      console.warn(`[Cron lembretes] Fila: item ${item.id} descartado — ${motivo}`)
      retryDescartados++
      continue
    }

    if (!emailDisponivel) continue

    const para = listaDeEmails(item.destinatarios)
    let resultado
    try {
      resultado = await enviarEmail(para, { assunto: item.assunto, texto: item.texto, html: item.html })
    } catch (err) {
      resultado = { sucesso: false, erro: err instanceof Error ? err.message : String(err) }
    }

    const novasTentativas = item.tentativas + 1
    const novoStatus = resultado.sucesso
      ? 'enviado'
      : novasTentativas >= item.maxTentativas
        ? 'falhou'
        : 'pendente'

    await db
      .update(emailQueue)
      .set({ tentativas: novasTentativas, status: novoStatus, proximoRetry: proximoRetry(novasTentativas, agora) })
      .where(eq(emailQueue.id, item.id))

    const eventoLog = eventoLogDoTipo(item.tipo)
    if (item.agendamentoId && eventoLog) {
      await db.insert(logsEmail).values({
        agendamentoId: item.agendamentoId,
        evento: eventoLog,
        paraEmail: item.destinatarios,
        assunto: item.assunto,
        idMensagemProvedor: 'idMensagem' in resultado ? (resultado.idMensagem ?? null) : null,
        status: resultado.sucesso ? 'enviado' : 'falhou',
        mensagemErro: resultado.erro ?? null,
      })
    }

    if (resultado.sucesso) retryProcessados++
    else retryFalhas++
  }

  // Retenção (LGPD): apaga registros de e-mail antigos, que guardam destinatários e textos
  let registrosApagados = 0
  try {
    const limite = new Date(agora.getTime() - RETENCAO_REGISTROS_EMAIL_DIAS * 24 * 60 * 60 * 1000)
    const logs = await db.delete(logsEmail).where(lt(logsEmail.criadoEm, limite)).returning({ id: logsEmail.id })
    const fila = await db
      .delete(emailQueue)
      .where(and(lt(emailQueue.criadoEm, limite), ne(emailQueue.status, 'pendente')))
      .returning({ id: emailQueue.id })
    registrosApagados = logs.length + fila.length
  } catch (erro) {
    console.error('[Cron lembretes] Falha na limpeza de registros antigos:', erro instanceof Error ? erro.message : erro)
  }

  // Retenção (LGPD): apaga cadastros sem atendimento há mais de RETENCAO_CADASTRO_ANOS anos
  let cadastrosApagados = 0
  try {
    for (const id of await idsCadastrosVencidos(db, agora)) {
      await db.transaction((tx) => apagarClienteComHistorico(tx, id))
      cadastrosApagados++
    }
  } catch (erro) {
    console.error('[Cron lembretes] Falha na limpeza de cadastros antigos:', erro instanceof Error ? erro.message : erro)
  }

  return NextResponse.json({
    horario: { processados, falhas, total: agendamentosLembrete.length, data_alvo: dataAmanha, executado: rodarLembretesHorario },
    retencao: { registros_apagados: registrosApagados, cadastros_apagados: cadastrosApagados },
    eventos: { processados: eventosProcessados, falhas: eventosFalhas, total: agEventos.length },
    sem_email: semEmail,
    retry: { processados: retryProcessados, falhas: retryFalhas, descartados: retryDescartados, total: fila.length },
    email_disponivel: emailDisponivel,
  })
}
