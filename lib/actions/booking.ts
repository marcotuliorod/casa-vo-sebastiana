'use server'

// Server Actions para o fluxo de agendamento público

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getSlotsDisponiveis } from '@/lib/queries/availability'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { mensagemConfirmacao, mensagemCancelamento } from '@/lib/whatsapp/templates'
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

  const supabase = createAdminClient()

  // 0. Validar que o slot solicitado existe e está disponível (BUG-02)
  const { slots } = await getSlotsDisponiveis(data)
  const slotValido = slots.some(
    (s) => s.hora_inicio === hora_inicio && s.hora_fim === hora_fim
  )
  if (!slotValido) {
    return { erro: 'Este horário não está mais disponível. Por favor, escolha outro.' }
  }

  // 1. Upsert do cliente (por telefone)
  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .upsert(
      {
        nome,
        telefone: telefoneNormalizado,
        email: email || null,
      },
      { onConflict: 'telefone', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (erroCliente || !cliente) {
    return { erro: 'Erro ao salvar seus dados. Tente novamente.' }
  }

  // 2. Criar agendamento
  const { data: agendamento, error: erroAgendamento } = await supabase
    .from('agendamentos')
    .insert({
      cliente_id: cliente.id,
      data_agendada: data,
      hora_inicio,
      hora_fim,
      status: 'confirmado',
      notas: notas || null,
    })
    .select()
    .single()

  if (erroAgendamento) {
    // Constraint de sobreposição ativada
    if (erroAgendamento.code === '23P01') {
      return { erro: 'Este horário já foi preenchido. Por favor, escolha outro.' }
    }
    return { erro: 'Erro ao criar agendamento. Tente novamente.' }
  }

  // 3. Enviar mensagem de confirmação via WhatsApp
  try {
    const provedor = getProvedorWhatsApp()
    const mensagem = mensagemConfirmacao({
      nomeCliente: nome,
      dataAgendada: data,
      horaInicio: hora_inicio,
      tokenPublico: agendamento.token_publico,
      baseUrl,
    })

    const resultado = await provedor.enviarMensagem({
      para: telefoneNormalizado,
      corpo: mensagem,
    })

    // Registrar log independente do resultado
    await supabase.from('logs_whatsapp').insert({
      agendamento_id: agendamento.id,
      evento: 'confirmacao_agendamento',
      provedor: provedor.nome,
      para_telefone: telefoneNormalizado,
      mensagem,
      id_mensagem_provedor: resultado.idMensagemProvedor ?? null,
      status: resultado.sucesso ? 'enviado' : 'falhou',
      mensagem_erro: resultado.erro ?? null,
    })
  } catch (err) {
    // Falha no WhatsApp não cancela o agendamento
    console.error('Erro ao enviar WhatsApp:', err)
  }

  // 4. Redirecionar para a página de confirmação
  redirect(`/agendamento/${agendamento.token_publico}`)
}

// Cancelar agendamento pelo token público
export async function cancelarAgendamento(token: string): Promise<{ erro?: string }> {
  const supabase = createAdminClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // Buscar o agendamento
  const { data: agendamento, error: erroQuery } = await supabase
    .from('agendamentos')
    .select('*, clientes(*)')
    .eq('token_publico', token)
    .single()

  if (erroQuery || !agendamento) {
    return { erro: 'Agendamento não encontrado.' }
  }

  if (agendamento.status === 'cancelado') {
    return { erro: 'Este agendamento já foi cancelado.' }
  }

  if (agendamento.status === 'realizado') {
    return { erro: 'Não é possível cancelar um atendimento já realizado.' }
  }

  // Atualizar status
  const { error: erroCancelamento } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado' })
    .eq('id', agendamento.id)

  if (erroCancelamento) {
    return { erro: 'Erro ao cancelar. Tente novamente.' }
  }

  // Enviar mensagem de cancelamento
  try {
    const provedor = getProvedorWhatsApp()
    const mensagem = mensagemCancelamento({
      nomeCliente: agendamento.clientes.nome,
      dataAgendada: agendamento.data_agendada,
      horaInicio: agendamento.hora_inicio,
      tokenPublico: token,
      baseUrl,
    })

    const resultado = await provedor.enviarMensagem({
      para: agendamento.clientes.telefone,
      corpo: mensagem,
    })

    await supabase.from('logs_whatsapp').insert({
      agendamento_id: agendamento.id,
      evento: 'cancelamento',
      provedor: provedor.nome,
      para_telefone: agendamento.clientes.telefone,
      mensagem,
      id_mensagem_provedor: resultado.idMensagemProvedor ?? null,
      status: resultado.sucesso ? 'enviado' : 'falhou',
      mensagem_erro: resultado.erro ?? null,
    })
  } catch (err) {
    console.error('Erro ao enviar WhatsApp de cancelamento:', err)
  }

  return {}
}
