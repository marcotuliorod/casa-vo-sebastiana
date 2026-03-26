'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createAdminClient, createServerSessionClient } from '@/lib/supabase/server'

async function verificarAdmin(): Promise<string | null> {
  const supabase = await createServerSessionClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) ?? []
  if (adminEmails.length > 0 && !adminEmails.includes(user.email ?? '')) return null
  return user.id
}

const schemaRecado = z.object({
  titulo:    z.string().min(2, 'Título muito curto').max(100, 'Título muito longo'),
  conteudo:  z.string().min(1, 'Conteúdo obrigatório').max(2000, 'Conteúdo muito longo'),
  prioridade: z.enum(['normal', 'importante', 'urgente']).default('normal'),
  fixado:    z.coerce.boolean().default(false),
})

export type EstadoFormRecado = { erro?: string; campo?: string } | null

function revalidar() {
  revalidatePath('/admin/recados')
  revalidatePath('/mediuns/[token]', 'layout')
}

export async function criarRecado(
  _estado: EstadoFormRecado,
  formData: FormData
): Promise<EstadoFormRecado> {
  const admin = await verificarAdmin()
  if (!admin) return { erro: 'Não autorizado' }

  const parsed = schemaRecado.safeParse({
    titulo:    formData.get('titulo'),
    conteudo:  formData.get('conteudo'),
    prioridade: formData.get('prioridade') ?? 'normal',
    fixado:    formData.get('fixado') === 'on',
  })

  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { erro: first.message, campo: String(first.path[0] ?? '') }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('recados').insert(parsed.data)

  if (error) return { erro: 'Erro ao criar recado. Tente novamente.' }

  revalidar()
  return null
}

export async function editarRecado(
  id: string,
  _estado: EstadoFormRecado,
  formData: FormData
): Promise<EstadoFormRecado> {
  const admin = await verificarAdmin()
  if (!admin) return { erro: 'Não autorizado' }

  const parsed = schemaRecado.safeParse({
    titulo:    formData.get('titulo'),
    conteudo:  formData.get('conteudo'),
    prioridade: formData.get('prioridade') ?? 'normal',
    fixado:    formData.get('fixado') === 'on',
  })

  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { erro: first.message, campo: String(first.path[0] ?? '') }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('recados')
    .update({ ...parsed.data, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { erro: 'Erro ao editar recado.' }

  revalidar()
  return null
}

export async function excluirRecado(id: string): Promise<{ erro?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { erro: 'Não autorizado' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('recados')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { erro: 'Erro ao excluir recado.' }

  revalidar()
  return {}
}

export async function toggleFixadoRecado(
  id: string,
  fixado: boolean
): Promise<{ erro?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { erro: 'Não autorizado' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('recados')
    .update({ fixado, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { erro: 'Erro ao atualizar recado.' }

  revalidar()
  return {}
}
