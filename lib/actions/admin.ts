'use server'

// Server Actions para o painel administrativo

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient, createServerSessionClient } from '@/lib/supabase/server'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { mensagemAtribuicaoMedium, mensagemCancelamento } from '@/lib/whatsapp/templates'
import { normalizarTelefone } from '@/lib/utils/phone'
import type { AppointmentStatus } from '@/types/database'

// Verifica se há um usuário autenticado e com email autorizado
async function verificarAdmin(): Promise<string | null> {
  const supabase = await createServerSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Não autorizado.'

  const adminEmails = process.env.ADMIN_EMAILS
    ?.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean) ?? []

  if (adminEmails.length > 0 && !adminEmails.includes((user.email ?? '').toLowerCase())) {
    return 'Não autorizado.'
  }

  return null
}

// Atualizar status de um agendamento
export async function atualizarStatusAgendamento(
  id: string,
  novoStatus: AppointmentStatus
): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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
        const agTyped = ag as unknown as { data_agendada: string; hora_inicio: string; hora_fim: string; token_publico: string; clientes: { nome: string; telefone: string } }
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
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const horaRegex = /^\d{2}:\d{2}$/
  for (const h of horarios) {
    if (!horaRegex.test(h.hora_inicio) || !horaRegex.test(h.hora_fim)) {
      return { erro: 'Formato de hora inválido.' }
    }
  }

  const supabase = createAdminClient()

  if (horarios.length === 0) {
    // Remover todos os slots do dia
    const { error } = await supabase
      .from('grade_horarios')
      .delete()
      .eq('dia_semana', diaSemana)
    if (error) return { erro: error.message }
  } else {
    // 1. Upsert dos slots novos/atualizados (sem risco de perda)
    const { error: erroUpsert } = await supabase.from('grade_horarios').upsert(
      horarios.map((h) => ({
        dia_semana: diaSemana,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        ativo: h.ativo,
      })),
      { onConflict: 'dia_semana,hora_inicio' }
    )
    if (erroUpsert) return { erro: erroUpsert.message }

    // 2. Remover slots que não estão mais na lista (somente após upsert bem-sucedido)
    const horasNovas = horarios.map((h) => h.hora_inicio)
    const { error: erroDelete } = await supabase
      .from('grade_horarios')
      .delete()
      .eq('dia_semana', diaSemana)
      .not('hora_inicio', 'in', `(${horasNovas.join(',')})`)
    if (erroDelete) return { erro: erroDelete.message }
  }

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // BUG-09: atualiza calendário público após salvar grade
  return {}
}

// Toggle ativo/inativo de um horário da grade
export async function toggleHorarioGrade(id: string, ativo: boolean): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('grade_horarios')
    .update({ ativo })
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // BUG-05: invalida calendário público
  return {}
}

// Inserir novo slot na grade (ainda não existia no banco)
export async function ativarNovoSlot(
  diaSemana: number,
  horaInicio: string,
  horaFim: string
): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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

export async function toggleMediumAtivo(id: string, ativo: boolean): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('mediuns')
    .update({ ativo })
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/mediuns')
  return {}
}

export async function atribuirMedium(
  agendamentoId: string,
  mediumId: string
): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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
        const agTyped = ag as unknown as { data_agendada: string; hora_inicio: string; hora_fim: string; clientes: { nome: string } }
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

// ─── Eventos ──────────────────────────────────────────────────────────────────

export type EstadoFormEvento = { erro?: string; campo?: string } | null

const schemaEvento = z.object({
  titulo: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  descricao: z.string().max(1000).optional().or(z.literal('')),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de início inválida'),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de fim inválida'),
  capacidade: z.coerce
    .number({ invalid_type_error: 'Capacidade inválida' })
    .int()
    .min(1, 'Capacidade mínima: 1')
    .max(500, 'Capacidade máxima: 500'),
  recorrencia: z.enum(['nenhuma', 'semanal', 'quinzenal', 'mensal'], {
    invalid_type_error: 'Recorrência inválida',
  }),
  data_fim_recorrencia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  lembrete_horas: z.coerce
    .number({ invalid_type_error: 'Lembrete inválido' })
    .int()
    .min(1)
    .max(168)
    .default(24),
})

export async function criarEvento(
  _estado: EstadoFormEvento,
  formData: FormData
): Promise<EstadoFormEvento> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaEvento.safeParse(dados)
  if (!resultado.success) {
    const primeiro = resultado.error.errors[0]
    return { erro: primeiro.message, campo: String(primeiro.path[0]) }
  }

  const {
    titulo, descricao, data_inicio, hora_inicio, hora_fim,
    capacidade, recorrencia, data_fim_recorrencia, lembrete_horas,
  } = resultado.data

  if (hora_fim <= hora_inicio) {
    return { erro: 'Hora de fim deve ser posterior à hora de início.', campo: 'hora_fim' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('eventos').insert({
    titulo,
    descricao: descricao || null,
    data_inicio,
    hora_inicio,
    hora_fim,
    capacidade,
    recorrencia,
    data_fim_recorrencia: data_fim_recorrencia || null,
    lembrete_horas,
  })

  if (error) return { erro: error.message }

  revalidatePath('/admin/eventos')
  revalidatePath('/agendar/eventos')
  return null
}

export async function editarEvento(
  id: string,
  _estado: EstadoFormEvento,
  formData: FormData
): Promise<EstadoFormEvento> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaEvento.safeParse(dados)
  if (!resultado.success) {
    const primeiro = resultado.error.errors[0]
    return { erro: primeiro.message, campo: String(primeiro.path[0]) }
  }

  const {
    titulo, descricao, data_inicio, hora_inicio, hora_fim,
    capacidade, recorrencia, data_fim_recorrencia, lembrete_horas,
  } = resultado.data

  if (hora_fim <= hora_inicio) {
    return { erro: 'Hora de fim deve ser posterior à hora de início.', campo: 'hora_fim' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('eventos')
    .update({
      titulo,
      descricao: descricao || null,
      data_inicio,
      hora_inicio,
      hora_fim,
      capacidade,
      recorrencia,
      data_fim_recorrencia: data_fim_recorrencia || null,
      lembrete_horas,
    })
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/eventos')
  revalidatePath('/agendar/eventos')
  return null
}

export async function toggleEventoAtivo(
  id: string,
  ativo: boolean
): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const supabase = createAdminClient()
  const { error } = await supabase.from('eventos').update({ ativo }).eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/eventos')
  revalidatePath('/agendar/eventos')
  return {}
}

export async function excluirEvento(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const supabase = createAdminClient()

  // Bloqueia exclusão se houver inscrições ativas
  const { count } = await supabase
    .from('agendamentos')
    .select('*', { count: 'exact', head: true })
    .eq('evento_id', id)
    .in('status', ['pendente', 'confirmado'])

  if ((count ?? 0) > 0) {
    return { erro: `Não é possível excluir: há ${count} inscrição(ões) ativa(s) neste evento. Cancele-as primeiro.` }
  }

  // Remove agendamentos históricos (cancelados/realizados) antes de deletar o evento
  await supabase.from('agendamentos').delete().eq('evento_id', id)

  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) return { erro: error.message }

  revalidatePath('/admin/eventos')
  revalidatePath('/agendar/eventos')
  return {}
}

// ─── Agendamentos: editar e excluir ──────────────────────────

export type EstadoFormAgendamento = { erro?: string; campo?: string } | null

const schemaEditarAgendamento = z.object({
  data_agendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de início inválida'),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Hora de fim inválida'),
  notas: z.string().max(500).optional().or(z.literal('')),
})

export async function editarAgendamento(
  id: string,
  _estado: EstadoFormAgendamento,
  formData: FormData
): Promise<EstadoFormAgendamento> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaEditarAgendamento.safeParse(dados)
  if (!resultado.success) {
    const primeiro = resultado.error.errors[0]
    return { erro: primeiro.message, campo: String(primeiro.path[0]) }
  }

  const { data_agendada, hora_inicio, hora_fim, notas } = resultado.data

  if (hora_fim <= hora_inicio) {
    return { erro: 'Hora de fim deve ser posterior à hora de início.', campo: 'hora_fim' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('agendamentos')
    .update({ data_agendada, hora_inicio, hora_fim, notas: notas || null })
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/agendamentos')
  revalidatePath('/admin')
  return null
}

export async function excluirAgendamento(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const supabase = createAdminClient()
  const { error } = await supabase.from('agendamentos').delete().eq('id', id)
  if (error) return { erro: error.message }

  revalidatePath('/admin/agendamentos')
  revalidatePath('/admin')
  return {}
}

// ─── Clientes/Consulentes: editar e excluir ──────────────────

export type EstadoFormCliente = { erro?: string; campo?: string } | null

const schemaCliente = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  telefone: z.string().min(8, 'Telefone obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notas: z.string().max(500).optional().or(z.literal('')),
})

export async function editarCliente(
  id: string,
  _estado: EstadoFormCliente,
  formData: FormData
): Promise<EstadoFormCliente> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaCliente.safeParse(dados)
  if (!resultado.success) {
    const primeiro = resultado.error.errors[0]
    return { erro: primeiro.message, campo: String(primeiro.path[0]) }
  }

  const { nome, telefone, email, notas } = resultado.data
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('clientes')
    .update({ nome, telefone, email: email || null, notas: notas || null })
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/consulentes')
  return null
}

export async function excluirCliente(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const supabase = createAdminClient()

  const { count } = await supabase
    .from('agendamentos')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', id)
    .in('status', ['pendente', 'confirmado'])

  if ((count ?? 0) > 0) {
    return { erro: `Não é possível excluir: há ${count} agendamento(s) ativo(s) para este consulente.` }
  }

  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) return { erro: error.message }

  revalidatePath('/admin/consulentes')
  return {}
}

// ─── Médiuns: editar e excluir ───────────────────────────────

export type EstadoFormMedium = { erro?: string } | null

export async function editarMedium(
  id: string,
  _estado: EstadoFormMedium,
  formData: FormData
): Promise<EstadoFormMedium> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaMedium.safeParse(dados)
  if (!resultado.success) return { erro: resultado.error.errors[0].message }

  const { nome, especialidade, telefone } = resultado.data
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('mediuns')
    .update({ nome, especialidade: especialidade || null, telefone: telefone || null })
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath('/admin/mediuns')
  return null
}

export async function excluirMedium(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const supabase = createAdminClient()

  // Remove vínculo de agendamentos antes de excluir
  await supabase.from('agendamentos').update({ medium_id: null }).eq('medium_id', id)

  const { error } = await supabase.from('mediuns').delete().eq('id', id)
  if (error) return { erro: error.message }

  revalidatePath('/admin/mediuns')
  revalidatePath('/admin/agendamentos')
  return {}
}
