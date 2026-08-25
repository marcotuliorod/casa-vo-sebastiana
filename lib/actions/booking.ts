'use server'

// Server Actions para o fluxo de agendamento público

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { and, count, eq, gte, lt, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, clientes, logsWhatsapp, whatsappQueue } from '@/lib/db/schema'
import { mensagemErro, codigoPg } from '@/lib/db/errors'
import { getSlotsDisponiveis } from '@/lib/queries/availability'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { mensagemConfirmacao, mensagemCancelamento, mensagemNovoAgendamentoAdmin, mensagemCancelamentoAdmin, mensagemConfirmacaoEvento } from '@/lib/whatsapp/templates'
import { getEvento, contarInscritosOcorrencia } from '@/lib/queries/eventos'
import { ehOcorrenciaValida } from '@/lib/utils/recorrencia'
import { normalizarTelefone } from '@/lib/utils/phone'

// Schema de validação para criação de agendamento
const schemaCriarAgendamento = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  telefone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notas: z.string().max(500).optional(),
})

export type EstadoFormAgendamento = {
  erro?: string
  campo?: string
} | null

export async function criarAgendamento(
  _estado: EstadoFormAgendamento,
  formData: FormData
): Promise<EstadoFormAgendamento> {
  const dados = Object.fromEntries(formData.entries())

  const resultado = schemaCriarAgendamento.safeParse(dados)
  if (!resultado.success) {
    const primeiroErro = resultado.error.errors[0]
    return { erro: primeiroErro.message, campo: String(primeiroErro.path[0]) }
  }

  const { data, hora_inicio, hora_fim, nome, telefone, email, notas } = resultado.data
  const telefoneNormalizado = normalizarTelefone(telefone)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // 0a. US-19: verificar limite de agendamentos por cliente por mês
  const limiteStr = process.env.MAX_AGENDAMENTOS_MES
  if (limiteStr) {
    const limite = parseInt(limiteStr, 10)
    if (!isNaN(limite) && limite > 0) {
      const inicioMes = `${data.slice(0, 7)}-01`
      const [anoNum, mesNum] = data.split('-').map(Number)
      const inicioProxMes = mesNum === 12
        ? `${anoNum + 1}-01-01`
        : `${anoNum}-${String(mesNum + 1).padStart(2, '0')}-01`

      const [clienteExistente] = await db
        .select({ id: clientes.id })
        .from(clientes)
        .where(eq(clientes.telefone, telefoneNormalizado))
        .limit(1)

      if (clienteExistente) {
        const [{ value: totalNoMes }] = await db
          .select({ value: count() })
          .from(agendamentos)
          .where(
            and(
              eq(agendamentos.clienteId, clienteExistente.id),
              gte(agendamentos.dataAgendada, inicioMes),
              lt(agendamentos.dataAgendada, inicioProxMes),
              ne(agendamentos.status, 'cancelado')
            )
          )

        if (totalNoMes >= limite) {
          return {
            erro: `Você já tem ${limite} agendamento${limite !== 1 ? 's' : ''} neste mês. Entre em contato com a casa para mais informações.`,
          }
        }
      }
    }
  }

  // 0b. Validar que o slot solicitado existe e está disponível (BUG-02)
  const { slots } = await getSlotsDisponiveis(data)
  const slotValido = slots.some(
    (s) => s.hora_inicio === hora_inicio && s.hora_fim === hora_fim
  )
  if (!slotValido) {
    return { erro: 'Este horário não está mais disponível. Por favor, escolha outro.' }
  }

  // 1. Upsert do cliente (por telefone)
  let cliente
  try {
    ;[cliente] = await db
      .insert(clientes)
      .values({ nome, telefone: telefoneNormalizado, email: email || null })
      .onConflictDoUpdate({
        target: clientes.telefone,
        set: { nome, email: email || null },
      })
      .returning()
  } catch {
    return { erro: 'Erro ao salvar seus dados. Tente novamente.' }
  }

  // 2. Criar agendamento
  let agendamento
  try {
    ;[agendamento] = await db
      .insert(agendamentos)
      .values({
        clienteId: cliente.id,
        dataAgendada: data,
        horaInicio: hora_inicio,
        horaFim: hora_fim,
        status: 'pendente',
        notas: notas || null,
      })
      .returning()
  } catch (erro) {
    // Constraint de sobreposição ativada
    if (codigoPg(erro) === '23P01') {
      return { erro: 'Este horário já foi preenchido. Por favor, escolha outro.' }
    }
    return { erro: 'Erro ao criar agendamento. Tente novamente.' }
  }

  // 3. Enviar mensagem de confirmação via WhatsApp
  const mensagemWpp = mensagemConfirmacao({
    nomeCliente: nome,
    dataAgendada: data,
    horaInicio: hora_inicio,
    tokenPublico: agendamento.tokenPublico,
    baseUrl,
  })

  try {
    const provedor = getProvedorWhatsApp()
    const resultadoEnvio = await provedor.enviarMensagem({
      para: telefoneNormalizado,
      corpo: mensagemWpp,
    })

    await db.insert(logsWhatsapp).values({
      agendamentoId: agendamento.id,
      evento: 'confirmacao_agendamento',
      provedor: provedor.nome,
      paraTelefone: telefoneNormalizado,
      mensagem: mensagemWpp,
      idMensagemProvedor: resultadoEnvio.idMensagemProvedor ?? null,
      status: resultadoEnvio.sucesso ? 'enviado' : 'falhou',
      mensagemErro: resultadoEnvio.erro ?? null,
    })

    // US-16: enfileirar retry se falhou
    if (!resultadoEnvio.sucesso) {
      await db.insert(whatsappQueue).values({
        agendamentoId: agendamento.id,
        telefone: telefoneNormalizado,
        mensagem: mensagemWpp,
        tipo: 'confirmacao',
      })
    }
  } catch (err) {
    // Falha no WhatsApp (ex: credenciais ausentes) não cancela o agendamento
    console.error('[WhatsApp] Falha ao enviar confirmação:', err)
    // US-16: enfileirar para retry quando credenciais estiverem configuradas
    try {
      await db.insert(whatsappQueue).values({
        agendamentoId: agendamento.id,
        telefone: telefoneNormalizado,
        mensagem: mensagemWpp,
        tipo: 'confirmacao',
      })
    } catch (erroFila) {
      console.error('[WhatsApp] Falha ao enfileirar retry:', mensagemErro(erroFila))
    }
  }

  // 4. Notificar admin sobre novo agendamento (US-17)
  const adminWhatsApp = process.env.ADMIN_WHATSAPP
  if (adminWhatsApp) {
    try {
      const provedor = getProvedorWhatsApp()
      const msgAdmin = mensagemNovoAgendamentoAdmin({
        nomeCliente: nome,
        telefoneCliente: telefoneNormalizado,
        dataAgendada: data,
        horaInicio: hora_inicio,
        horaFim: hora_fim,
      })
      await provedor.enviarMensagem({ para: adminWhatsApp, corpo: msgAdmin })
    } catch (err) {
      console.error('[WhatsApp] Falha ao notificar admin:', err)
    }
  }

  // 5. Redirecionar para a página de confirmação
  redirect(`/agendamento/${agendamento.tokenPublico}`)
}

// ─── Inscrição em Evento ──────────────────────────────────────

const schemaInscreverEvento = z.object({
  evento_id: z.string().uuid('Evento inválido'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  telefone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notas: z.string().max(500).optional(),
})

export async function inscreverEmEvento(
  _estado: EstadoFormAgendamento,
  formData: FormData
): Promise<EstadoFormAgendamento> {
  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaInscreverEvento.safeParse(dados)

  if (!resultado.success) {
    const primeiroErro = resultado.error.errors[0]
    return { erro: primeiroErro.message, campo: String(primeiroErro.path[0]) }
  }

  const { evento_id, data, nome, telefone, email, notas } = resultado.data
  const telefoneNormalizado = normalizarTelefone(telefone)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // 1. Verificar evento ativo
  const evento = await getEvento(evento_id)
  if (!evento || !evento.ativo) {
    return { erro: 'Este evento não está disponível.' }
  }

  // 2. Verificar que a data é uma ocorrência válida do evento
  const ocorrenciaValida = ehOcorrenciaValida({
    data,
    data_inicio: evento.data_inicio,
    recorrencia: evento.recorrencia,
    data_fim_recorrencia: evento.data_fim_recorrencia,
  })
  if (!ocorrenciaValida) {
    return { erro: 'Data inválida para este evento.' }
  }

  // 3. Verificar capacidade (verificação pessimista antes do insert)
  const inscritos = await contarInscritosOcorrencia(evento_id, data)
  if (inscritos >= evento.capacidade) {
    return { erro: 'Não há mais vagas disponíveis para esta data.' }
  }

  // 4. Upsert do cliente (por telefone)
  let cliente
  try {
    ;[cliente] = await db
      .insert(clientes)
      .values({ nome, telefone: telefoneNormalizado, email: email || null })
      .onConflictDoUpdate({
        target: clientes.telefone,
        set: { nome, email: email || null },
      })
      .returning()
  } catch {
    return { erro: 'Erro ao salvar seus dados. Tente novamente.' }
  }

  // 5. Criar agendamento vinculado ao evento
  let agendamento
  try {
    ;[agendamento] = await db
      .insert(agendamentos)
      .values({
        clienteId: cliente.id,
        eventoId: evento_id,
        dataAgendada: data,
        horaInicio: evento.hora_inicio,
        horaFim: evento.hora_fim,
        status: 'pendente',
        notas: notas || null,
      })
      .returning()
  } catch {
    return { erro: 'Erro ao registrar inscrição. Tente novamente.' }
  }

  // 6. Enviar confirmação via WhatsApp
  const mensagemWpp = mensagemConfirmacaoEvento({
    nomeCliente: nome,
    tituloEvento: evento.titulo,
    dataEvento: data,
    horaInicio: evento.hora_inicio.slice(0, 5),
    horaFim: evento.hora_fim.slice(0, 5),
    tokenPublico: agendamento.tokenPublico,
    baseUrl,
  })

  try {
    const provedor = getProvedorWhatsApp()
    const resultadoWpp = await provedor.enviarMensagem({
      para: telefoneNormalizado,
      corpo: mensagemWpp,
    })

    await db.insert(logsWhatsapp).values({
      agendamentoId: agendamento.id,
      evento: 'confirmacao_agendamento',
      provedor: provedor.nome,
      paraTelefone: telefoneNormalizado,
      mensagem: mensagemWpp,
      idMensagemProvedor: resultadoWpp.idMensagemProvedor ?? null,
      status: resultadoWpp.sucesso ? 'enviado' : 'falhou',
      mensagemErro: resultadoWpp.erro ?? null,
    })

    if (!resultadoWpp.sucesso) {
      await db.insert(whatsappQueue).values({
        agendamentoId: agendamento.id,
        telefone: telefoneNormalizado,
        mensagem: mensagemWpp,
        tipo: 'confirmacao',
      })
    }
  } catch (err) {
    console.error('[WhatsApp] Falha ao enviar confirmação de evento:', err)
    try {
      await db.insert(whatsappQueue).values({
        agendamentoId: agendamento.id,
        telefone: telefoneNormalizado,
        mensagem: mensagemWpp,
        tipo: 'confirmacao',
      })
    } catch (erroFila) {
      console.error('[WhatsApp] Falha ao enfileirar retry:', mensagemErro(erroFila))
    }
  }

  // 7. Notificar admin
  const adminWhatsApp = process.env.ADMIN_WHATSAPP
  if (adminWhatsApp) {
    try {
      const provedor = getProvedorWhatsApp()
      await provedor.enviarMensagem({
        para: adminWhatsApp,
        corpo: mensagemNovoAgendamentoAdmin({
          nomeCliente: nome,
          telefoneCliente: telefoneNormalizado,
          dataAgendada: data,
          horaInicio: evento.hora_inicio.slice(0, 5),
          horaFim: evento.hora_fim.slice(0, 5),
        }),
      })
    } catch (err) {
      console.error('[WhatsApp] Falha ao notificar admin sobre evento:', err)
    }
  }

  redirect(`/agendamento/${agendamento.tokenPublico}`)
}

// ─── Cancelar agendamento pelo token público ──────────────────
export async function cancelarAgendamento(token: string): Promise<{ erro?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // Buscar o agendamento
  const agendamento = await db.query.agendamentos.findFirst({
    where: eq(agendamentos.tokenPublico, token),
    with: { cliente: true },
  })

  if (!agendamento) {
    return { erro: 'Agendamento não encontrado.' }
  }

  if (agendamento.status === 'cancelado') {
    return { erro: 'Este agendamento já foi cancelado.' }
  }

  if (agendamento.status === 'realizado') {
    return { erro: 'Não é possível cancelar um atendimento já realizado.' }
  }

  // Atualizar status
  try {
    await db.update(agendamentos).set({ status: 'cancelado' }).where(eq(agendamentos.id, agendamento.id))
  } catch {
    return { erro: 'Erro ao cancelar. Tente novamente.' }
  }

  // Enviar mensagem de cancelamento ao consulente
  try {
    const provedor = getProvedorWhatsApp()
    const mensagem = mensagemCancelamento({
      nomeCliente: agendamento.cliente.nome,
      dataAgendada: agendamento.dataAgendada,
      horaInicio: agendamento.horaInicio,
      tokenPublico: token,
      baseUrl,
    })

    const resultado = await provedor.enviarMensagem({
      para: agendamento.cliente.telefone,
      corpo: mensagem,
    })

    await db.insert(logsWhatsapp).values({
      agendamentoId: agendamento.id,
      evento: 'cancelamento',
      provedor: provedor.nome,
      paraTelefone: agendamento.cliente.telefone,
      mensagem,
      idMensagemProvedor: resultado.idMensagemProvedor ?? null,
      status: resultado.sucesso ? 'enviado' : 'falhou',
      mensagemErro: resultado.erro ?? null,
    })
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar mensagem de cancelamento:', err)
  }

  // Notificar admin sobre cancelamento (US-21)
  const adminWhatsApp = process.env.ADMIN_WHATSAPP
  if (adminWhatsApp) {
    try {
      const provedor = getProvedorWhatsApp()
      const msgAdmin = mensagemCancelamentoAdmin({
        nomeCliente: agendamento.cliente.nome,
        telefoneCliente: agendamento.cliente.telefone,
        dataAgendada: agendamento.dataAgendada,
        horaInicio: agendamento.horaInicio,
        horaFim: agendamento.horaFim,
      })
      await provedor.enviarMensagem({ para: adminWhatsApp, corpo: msgAdmin })
    } catch (err) {
      console.error('[WhatsApp] Falha ao notificar admin sobre cancelamento:', err)
    }
  }

  return {}
}
