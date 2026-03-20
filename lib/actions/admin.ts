'use server'

// Server Actions para o painel administrativo

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
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
}
