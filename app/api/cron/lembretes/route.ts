// Cron job: envia lembretes de 24h para agendamentos confirmados de amanhã
// Configurado no vercel.json para rodar às 12:00 UTC (09:00 BRT)

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { mensagemLembrete24h } from '@/lib/whatsapp/templates'
import { amanha } from '@/lib/utils/date'

export async function GET(request: NextRequest) {
  // Verificar autorização do cron (segurança básica)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const dataAmanha = amanha()

  // Buscar agendamentos confirmados de amanhã sem lembrete enviado
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select('*, clientes(*)')
    .eq('data_agendada', dataAmanha)
    .eq('status', 'confirmado')
    .eq('lembrete_enviado', false)

  if (error) {
    console.error('[Cron lembretes] Erro na query:', error.message)
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  if (!agendamentos?.length) {
    return NextResponse.json({
      processados: 0,
      falhas: 0,
      mensagem: 'Nenhum lembrete para enviar hoje.',
    })
  }

  let processados = 0
  let falhas = 0

  const provedor = getProvedorWhatsApp()

  for (const ag of agendamentos) {
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
    await supabase.from('logs_whatsapp').insert({
      agendamento_id: ag.id,
      evento: 'lembrete_24h',
      provedor: provedor.nome,
      para_telefone: ag.clientes.telefone,
      mensagem,
      id_mensagem_provedor: resultado.idMensagemProvedor ?? null,
      status: resultado.sucesso ? 'enviado' : 'falhou',
      mensagem_erro: resultado.erro ?? null,
    })

    if (resultado.sucesso) {
      // Marcar lembrete como enviado (idempotência)
      await supabase
        .from('agendamentos')
        .update({ lembrete_enviado: true })
        .eq('id', ag.id)

      processados++
    } else {
      console.error(
        `[Cron lembretes] Falha ao enviar para ${ag.clientes.telefone}:`,
        resultado.erro
      )
      falhas++
    }
  }

  return NextResponse.json({
    processados,
    falhas,
    total: agendamentos.length,
    data_alvo: dataAmanha,
  })
}
