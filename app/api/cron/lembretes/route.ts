// Cron job: envia lembretes de 24h para agendamentos confirmados de amanhã
// Disparado pelo container `cron` do Docker Compose (ver docker/cron/)

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, isNotNull, lt, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, logsWhatsapp, whatsappQueue } from '@/lib/db/schema'
import { getAgendamentosParaLembrete } from '@/lib/queries/appointments'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { mensagemLembrete24h, mensagemLembreteEvento } from '@/lib/whatsapp/templates'
import { amanha } from '@/lib/utils/date'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO, addHours } from 'date-fns'

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

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const dataAmanha = amanha()

  // Buscar agendamentos confirmados de amanhã sem lembrete enviado
  let agendamentosLembrete
  try {
    agendamentosLembrete = await getAgendamentosParaLembrete(dataAmanha)
  } catch (erro) {
    console.error('[Cron lembretes] Erro na query:', erro)
    return NextResponse.json({ erro: erro instanceof Error ? erro.message : 'Erro desconhecido' }, { status: 500 })
  }

  if (!agendamentosLembrete.length) {
    return NextResponse.json({
      processados: 0,
      falhas: 0,
      mensagem: 'Nenhum lembrete para enviar hoje.',
    })
  }

  let processados = 0
  let falhas = 0

  // BUG-OBS02: getProvedorWhatsApp() pode lançar se credenciais ausentes — não deve crashar o cron
  let provedor: ReturnType<typeof getProvedorWhatsApp> | null = null
  try {
    provedor = getProvedorWhatsApp()
  } catch (err) {
    console.error('[Cron lembretes] WhatsApp não disponível — pulando envio de lembretes:', err)
  }

  if (provedor) for (const ag of agendamentosLembrete) {
    const mensagem = mensagemLembrete24h({
      nomeCliente: ag.clientes.nome,
      dataAgendada: ag.data_agendada,
      horaInicio: ag.hora_inicio,
      tokenPublico: ag.token_publico,
      baseUrl,
    })

    const resultado = await provedor.enviarMensagem({
      para: ag.clientes.telefone,
      corpo: mensagem,
    })

    // Registrar log
    await db.insert(logsWhatsapp).values({
      agendamentoId: ag.id,
      evento: 'lembrete_24h',
      provedor: provedor.nome,
      paraTelefone: ag.clientes.telefone,
      mensagem,
      idMensagemProvedor: resultado.idMensagemProvedor ?? null,
      status: resultado.sucesso ? 'enviado' : 'falhou',
      mensagemErro: resultado.erro ?? null,
    })

    if (resultado.sucesso) {
      // Marcar lembrete como enviado (idempotência)
      await db.update(agendamentos).set({ lembreteEnviado: true }).where(eq(agendamentos.id, ag.id))

      processados++
    } else {
      console.error(
        `[Cron lembretes] Falha ao enviar para ***${ag.clientes.telefone.slice(-4)}:`,
        resultado.erro
      )
      falhas++
    }
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

  if (agEventos.length && provedor) {
    const agora = new Date()

    for (const ag of agEventos) {
      const evento = ag.evento
      if (!evento) continue

      // Calcula quando deve enviar: data_agendada + hora_inicio - lembrete_horas
      const dataHoraEvento = parseISO(`${ag.dataAgendada}T${ag.horaInicio}`)
      const momentoLembrete = addHours(dataHoraEvento, -evento.lembreteHoras)

      // Só envia se já passou do momento do lembrete (e ainda não passou o evento)
      if (agora < momentoLembrete || agora > dataHoraEvento) continue

      const mensagem = mensagemLembreteEvento({
        nomeCliente: ag.cliente.nome,
        tituloEvento: evento.titulo,
        dataEvento: ag.dataAgendada,
        horaInicio: ag.horaInicio.slice(0, 5),
        tokenPublico: ag.tokenPublico,
        baseUrl,
      })

      const resultado = await provedor.enviarMensagem({
        para: ag.cliente.telefone,
        corpo: mensagem,
      })

      await db.insert(logsWhatsapp).values({
        agendamentoId: ag.id,
        evento: 'lembrete_24h',
        provedor: provedor.nome,
        paraTelefone: ag.cliente.telefone,
        mensagem,
        idMensagemProvedor: resultado.idMensagemProvedor ?? null,
        status: resultado.sucesso ? 'enviado' : 'falhou',
        mensagemErro: resultado.erro ?? null,
      })

      if (resultado.sucesso) {
        await db.update(agendamentos).set({ lembreteEnviado: true }).where(eq(agendamentos.id, ag.id))
        eventosProcessados++
      } else {
        eventosFalhas++
      }
    }
  }

  // US-16: Processar fila de retry de mensagens com falha
  let retryProcessados = 0
  let retryFalhas = 0

  const agora = new Date()
  const fila = await db
    .select()
    .from(whatsappQueue)
    .where(
      and(
        eq(whatsappQueue.status, 'pendente'),
        lte(whatsappQueue.proximoRetry, agora),
        lt(whatsappQueue.tentativas, 3)
      )
    )

  if (fila.length) {
    let provedorRetry: ReturnType<typeof getProvedorWhatsApp> | null = null
    try {
      provedorRetry = getProvedorWhatsApp()
    } catch (err) {
      console.error('[Cron lembretes] WhatsApp não disponível — pulando retry queue:', err)
    }

    if (provedorRetry) for (const item of fila) {
      const resultado = await provedorRetry.enviarMensagem({
        para: item.telefone,
        corpo: item.mensagem,
      })

      const novasTentativas = item.tentativas + 1
      const novoStatus = resultado.sucesso
        ? 'enviado'
        : novasTentativas >= item.maxTentativas
          ? 'falhou'
          : 'pendente'

      // Próximo retry: backoff exponencial (15min, 1h, 4h)
      const minutosBackoff = [15, 60, 240][novasTentativas - 1] ?? 240
      const proximoRetry = new Date(Date.now() + minutosBackoff * 60 * 1000)

      await db
        .update(whatsappQueue)
        .set({ tentativas: novasTentativas, status: novoStatus, proximoRetry })
        .where(eq(whatsappQueue.id, item.id))

      if (resultado.sucesso) retryProcessados++
      else retryFalhas++
    }
  }

  return NextResponse.json({
    horario: { processados, falhas, total: agendamentosLembrete.length, data_alvo: dataAmanha },
    eventos: { processados: eventosProcessados, falhas: eventosFalhas, total: agEventos.length },
    retry: { processados: retryProcessados, falhas: retryFalhas, total: fila.length },
  })
}
