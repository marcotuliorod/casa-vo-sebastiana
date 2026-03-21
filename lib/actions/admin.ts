'use server'

// Server Actions para o painel administrativo

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { mensagemAtribuicaoMedium, mensagemCancelamento } from '@/lib/whatsapp/templates'
import { normalizarTelefone } from '@/lib/utils/phone'
import type { AppointmentStatus } from '@/types/database'

// Atualizar status de um agendamento
export async function atualizarStatusAgendamento(
  id: string,
  novoStatus: AppointmentStatus
): Promise<{ erro?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: novoStatus })
    .eq('id', id)

  if (error) return { erro: error.message }

  // GAP-01: notificar consulente por WhatsApp quando admin cancela
  if (novoStatus === 'cancelado') {
    try {
      const { data: ag } = await supabase
        .from('agendamentos')
        .select('data_agendada, hora_inicio, hora_fim, token_publico, clientes(nome, telefone)')
        .eq('id', id)
        .single()

      if (ag) {
        const provedor = getProvedorWhatsApp()
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
        const agTyped = ag as { data_agendada: string; hora_inicio: string; hora_fim: string; token_publico: string; clientes: { nome: string; telefone: string } }
        await provedor.enviarMensagem({
          para: normalizarTelefone(agTyped.clientes.telefone),
          corpo: mensagemCancelamento({
            nomeCliente: agTyped.clientes.nome,
            dataAgendada: agTyped.data_agendada,
            horaInicio: agTyped.hora_inicio,
            tokenPublico: agTyped.token_publico,
            baseUrl,
          }),
        })
      }
    } catch {
      // WhatsApp falhou — não impede o cancelamento
    }
  }

  revalidatePath('/admin/agendamentos')
  revalidatePath('/admin')
  return {}
}

// Schema para bloqueio de data/horário
const schemaBloqueio = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  motivo: z.string().optional(),
})

export async function bloquearData(
  _estado: { erro?: string } | null,
  formData: FormData
): Promise<{ erro?: string }> {
  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaBloqueio.safeParse(dados)

  if (!resultado.success) {
    return { erro: resultado.error.errors[0].message }
  }

  const { data, hora_inicio, hora_fim, motivo } = resultado.data
  const supabase = createAdminClient()

  const { error } = await supabase.from('datas_bloqueadas').insert({
    data_bloqueada: data,
    hora_inicio: hora_inicio || null,
    hora_fim: hora_fim || null,
    motivo: motivo || null,
  })

  if (error) {
    if (error.code === '23505') {
      return { erro: 'Este horário já está bloqueado.' }
    }
    return { erro: error.message }
  }

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // GAP-03 / BUG-09: invalida calendário público ao bloquear data
  return {}
}

export async function desbloquearData(id: string): Promise<{ erro?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('datas_bloqueadas')
    .delete()
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // GAP-03: invalida calendário público ao desbloquear data
  return {}
}

// Atualizar grade de horários semanal
export async function atualizarGradeHorarios(
  diaSemana: number,
  horarios: Array<{ hora_inicio: string; hora_fim: string; ativo: boolean }>
): Promise<{ erro?: string }> {
  const supabase = createAdminClient()

  // Deletar todos os horários do dia e reinserir
  const { error: erroDelete } = await supabase
    .from('grade_horarios')
    .delete()
    .eq('dia_semana', diaSemana)

  if (erroDelete) return { erro: erroDelete.message }

  if (horarios.length > 0) {
    const { error: erroInsert } = await supabase.from('grade_horarios').insert(
      horarios.map((h) => ({
        dia_semana: diaSemana,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        ativo: h.ativo,
      }))
    )

    if (erroInsert) return { erro: erroInsert.message }
  }

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // BUG-09: atualiza calendário público após salvar grade
  return {}
}

// Toggle ativo/inativo de um horário da grade
export async function toggleHorarioGrade(id: string, ativo: boolean) {
  const supabase = createAdminClient()

  await supabase
    .from('grade_horarios')
    .update({ ativo })
    .eq('id', id)

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // BUG-05: invalida calendário público
}

// Inserir novo slot na grade (ainda não existia no banco)
export async function ativarNovoSlot(
  diaSemana: number,
  horaInicio: string,
  horaFim: string
): Promise<{ erro?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase.from('grade_horarios').upsert(
    { dia_semana: diaSemana, hora_inicio: horaInicio, hora_fim: horaFim, ativo: true },
    { onConflict: 'dia_semana,hora_inicio' }
  )

  if (error) return { erro: error.message } // BUG-06: propaga erro ao invés de falhar silenciosamente

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // BUG-05: invalida calendário público
  return {}
}

// ─── Médiuns ──────────────────────────────────────────────────────────────────

const schemaMedium = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  especialidade: z.string().optional(),
  telefone: z.string().optional(),
})

export async function criarMedium(
  _estado: { erro?: string } | null,
  formData: FormData
): Promise<{ erro?: string }> {
  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaMedium.safeParse(dados)

  if (!resultado.success) {
    return { erro: resultado.error.errors[0].message }
  }

  const { nome, especialidade, telefone } = resultado.data
  const supabase = createAdminClient()

  const { error } = await supabase.from('mediuns').insert({
    nome,
    especialidade: especialidade || null,
    telefone: telefone || null,
  })

  if (error) return { erro: error.message }

  revalidatePath('/admin/mediuns')
  return {}
}

export async function toggleMediumAtivo(id: string, ativo: boolean): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('mediuns')
    .update({ ativo })
    .eq('id', id)

  revalidatePath('/admin/mediuns')
}

export async function atribuirMedium(
  agendamentoId: string,
  mediumId: string
): Promise<{ erro?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('agendamentos')
    .update({ medium_id: mediumId || null })
    .eq('id', agendamentoId)

  if (error) return { erro: error.message }

  // US-27: notificar médium via WhatsApp ao ser atribuído
  if (mediumId) {
    try {
      const [{ data: ag }, { data: med }] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('data_agendada, hora_inicio, hora_fim, clientes(nome)')
          .eq('id', agendamentoId)
          .single(),
        supabase
          .from('mediuns')
          .select('nome, telefone')
          .eq('id', mediumId)
          .single(),
      ])

      const telefone = (med as { nome: string; telefone: string | null } | null)?.telefone
      if (ag && telefone) {
        const provedor = getProvedorWhatsApp()
        const telefoneNormalizado = normalizarTelefone(telefone)
        const agTyped = ag as { data_agendada: string; hora_inicio: string; hora_fim: string; clientes: { nome: string } }
        await provedor.enviarMensagem({
          para: telefoneNormalizado,
          corpo: mensagemAtribuicaoMedium({
            nomeMedium: (med as { nome: string }).nome,
            nomeCliente: agTyped.clientes.nome,
            dataAgendada: agTyped.data_agendada,
            horaInicio: agTyped.hora_inicio,
            horaFim: agTyped.hora_fim,
          }),
        })
      }
    } catch {
      // WhatsApp falhou — não impede a atribuição
    }
  }

  revalidatePath('/admin/agendamentos')
  revalidatePath('/admin') // BUG-07: sincroniza Dashboard após atribuição de médium
  return {}
}
