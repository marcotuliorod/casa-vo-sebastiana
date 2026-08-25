'use server'

// Server Actions para o painel administrativo

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { and, count, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, clientes, datasBloqueadas, eventos, gradeHorarios, mediuns } from '@/lib/db/schema'
import { mensagemErro, codigoPg } from '@/lib/db/errors'
import { verificarAdmin } from '@/lib/auth/admin'
import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { mensagemAtribuicaoMedium, mensagemCancelamento } from '@/lib/whatsapp/templates'
import { normalizarTelefone } from '@/lib/utils/phone'
import type { AppointmentStatus } from '@/types/database'

// Atualizar status de um agendamento
export async function atualizarStatusAgendamento(
  id: string,
  novoStatus: AppointmentStatus
): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db.update(agendamentos).set({ status: novoStatus }).where(eq(agendamentos.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  // GAP-01: notificar consulente por WhatsApp quando admin cancela
  if (novoStatus === 'cancelado') {
    try {
      const ag = await db.query.agendamentos.findFirst({
        where: eq(agendamentos.id, id),
        with: { cliente: true },
      })

      if (ag) {
        const provedor = getProvedorWhatsApp()
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
        await provedor.enviarMensagem({
          para: normalizarTelefone(ag.cliente.telefone),
          corpo: mensagemCancelamento({
            nomeCliente: ag.cliente.nome,
            dataAgendada: ag.dataAgendada,
            horaInicio: ag.horaInicio,
            tokenPublico: ag.tokenPublico,
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

  try {
    await db.insert(datasBloqueadas).values({
      dataBloqueada: data,
      horaInicio: hora_inicio || null,
      horaFim: hora_fim || null,
      motivo: motivo || null,
    })
  } catch (erro) {
    if (codigoPg(erro) === '23505') {
      return { erro: 'Este horário já está bloqueado.' }
    }
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // GAP-03 / BUG-09: invalida calendário público ao bloquear data
  return {}
}

export async function desbloquearData(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db.delete(datasBloqueadas).where(eq(datasBloqueadas.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

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

  if (horarios.length === 0) {
    // Remover todos os slots do dia
    try {
      await db.delete(gradeHorarios).where(eq(gradeHorarios.diaSemana, diaSemana))
    } catch (erro) {
      return { erro: mensagemErro(erro) }
    }
  } else {
    // 1. Upsert dos slots novos/atualizados (sem risco de perda)
    try {
      await db
        .insert(gradeHorarios)
        .values(
          horarios.map((h) => ({
            diaSemana,
            horaInicio: h.hora_inicio,
            horaFim: h.hora_fim,
            ativo: h.ativo,
          }))
        )
        .onConflictDoUpdate({
          target: [gradeHorarios.diaSemana, gradeHorarios.horaInicio],
          set: { horaFim: sql`excluded.hora_fim`, ativo: sql`excluded.ativo` },
        })
    } catch (erro) {
      return { erro: mensagemErro(erro) }
    }

    // 2. Remover slots que não estão mais na lista (somente após upsert bem-sucedido)
    const horasNovas = horarios.map((h) => h.hora_inicio)
    try {
      await db
        .delete(gradeHorarios)
        .where(and(eq(gradeHorarios.diaSemana, diaSemana), notInArray(gradeHorarios.horaInicio, horasNovas)))
    } catch (erro) {
      return { erro: mensagemErro(erro) }
    }
  }

  revalidatePath('/admin/disponibilidade')
  revalidatePath('/agendar') // BUG-09: atualiza calendário público após salvar grade
  return {}
}

// Toggle ativo/inativo de um horário da grade
export async function toggleHorarioGrade(id: string, ativo: boolean): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db.update(gradeHorarios).set({ ativo }).where(eq(gradeHorarios.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

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

  try {
    await db
      .insert(gradeHorarios)
      .values({ diaSemana, horaInicio, horaFim, ativo: true })
      .onConflictDoUpdate({
        target: [gradeHorarios.diaSemana, gradeHorarios.horaInicio],
        set: { horaFim, ativo: true },
      })
  } catch (erro) {
    return { erro: mensagemErro(erro) } // BUG-06: propaga erro ao invés de falhar silenciosamente
  }

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

  try {
    await db.insert(mediuns).values({
      nome,
      especialidade: especialidade || null,
      telefone: telefone || null,
    })
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/mediuns')
  return {}
}

export async function toggleMediumAtivo(id: string, ativo: boolean): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db.update(mediuns).set({ ativo }).where(eq(mediuns.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/mediuns')
  return {}
}

export async function atribuirMedium(
  agendamentoId: string,
  mediumId: string
): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db
      .update(agendamentos)
      .set({ mediumId: mediumId || null })
      .where(eq(agendamentos.id, agendamentoId))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  // US-27: notificar médium via WhatsApp ao ser atribuído
  if (mediumId) {
    try {
      const [ag, medium] = await Promise.all([
        db.query.agendamentos.findFirst({
          where: eq(agendamentos.id, agendamentoId),
          with: { cliente: true },
        }),
        db.query.mediuns.findFirst({ where: eq(mediuns.id, mediumId) }),
      ])

      if (ag && medium?.telefone) {
        const provedor = getProvedorWhatsApp()
        const telefoneNormalizado = normalizarTelefone(medium.telefone)
        await provedor.enviarMensagem({
          para: telefoneNormalizado,
          corpo: mensagemAtribuicaoMedium({
            nomeMedium: medium.nome,
            nomeCliente: ag.cliente.nome,
            dataAgendada: ag.dataAgendada,
            horaInicio: ag.horaInicio,
            horaFim: ag.horaFim,
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

  try {
    await db.insert(eventos).values({
      titulo,
      descricao: descricao || null,
      dataInicio: data_inicio,
      horaInicio: hora_inicio,
      horaFim: hora_fim,
      capacidade,
      recorrencia,
      dataFimRecorrencia: data_fim_recorrencia || null,
      lembreteHoras: lembrete_horas,
    })
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

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

  try {
    await db
      .update(eventos)
      .set({
        titulo,
        descricao: descricao || null,
        dataInicio: data_inicio,
        horaInicio: hora_inicio,
        horaFim: hora_fim,
        capacidade,
        recorrencia,
        dataFimRecorrencia: data_fim_recorrencia || null,
        lembreteHoras: lembrete_horas,
      })
      .where(eq(eventos.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

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

  try {
    await db.update(eventos).set({ ativo }).where(eq(eventos.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/eventos')
  revalidatePath('/agendar/eventos')
  return {}
}

export async function excluirEvento(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  // Bloqueia exclusão se houver inscrições ativas
  const [{ value: totalAtivos }] = await db
    .select({ value: count() })
    .from(agendamentos)
    .where(and(eq(agendamentos.eventoId, id), inArray(agendamentos.status, ['pendente', 'confirmado'])))

  if (totalAtivos > 0) {
    return { erro: `Não é possível excluir: há ${totalAtivos} inscrição(ões) ativa(s) neste evento. Cancele-as primeiro.` }
  }

  try {
    // Remove agendamentos históricos (cancelados/realizados) antes de deletar o evento
    await db.delete(agendamentos).where(eq(agendamentos.eventoId, id))
    await db.delete(eventos).where(eq(eventos.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

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

  try {
    await db
      .update(agendamentos)
      .set({ dataAgendada: data_agendada, horaInicio: hora_inicio, horaFim: hora_fim, notas: notas || null })
      .where(eq(agendamentos.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/agendamentos')
  revalidatePath('/admin')
  return null
}

export async function excluirAgendamento(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db.delete(agendamentos).where(eq(agendamentos.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

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

  try {
    await db
      .update(clientes)
      .set({ nome, telefone, email: email || null, notas: notas || null })
      .where(eq(clientes.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/consulentes')
  return null
}

export async function excluirCliente(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const [{ value: totalAtivos }] = await db
    .select({ value: count() })
    .from(agendamentos)
    .where(and(eq(agendamentos.clienteId, id), inArray(agendamentos.status, ['pendente', 'confirmado'])))

  if (totalAtivos > 0) {
    return { erro: `Não é possível excluir: há ${totalAtivos} agendamento(s) ativo(s) para este consulente.` }
  }

  try {
    await db.delete(clientes).where(eq(clientes.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

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

  try {
    await db
      .update(mediuns)
      .set({ nome, especialidade: especialidade || null, telefone: telefone || null })
      .where(eq(mediuns.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/mediuns')
  return null
}

export async function excluirMedium(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    // Remove vínculo de agendamentos antes de excluir
    await db.update(agendamentos).set({ mediumId: null }).where(eq(agendamentos.mediumId, id))
    await db.delete(mediuns).where(eq(mediuns.id, id))
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/mediuns')
  revalidatePath('/admin/agendamentos')
  return {}
}
