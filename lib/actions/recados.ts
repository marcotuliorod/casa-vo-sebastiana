'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { recados } from '@/lib/db/schema'
import { verificarAdmin } from '@/lib/auth/admin'

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
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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

  try {
    await db.insert(recados).values(parsed.data)
  } catch {
    return { erro: 'Erro ao criar recado. Tente novamente.' }
  }

  revalidar()
  return null
}

export async function editarRecado(
  id: string,
  _estado: EstadoFormRecado,
  formData: FormData
): Promise<EstadoFormRecado> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

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

  try {
    await db
      .update(recados)
      .set({ ...parsed.data, atualizadoEm: new Date() })
      .where(eq(recados.id, id))
  } catch {
    return { erro: 'Erro ao editar recado.' }
  }

  revalidar()
  return null
}

export async function excluirRecado(id: string): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db.update(recados).set({ ativo: false, atualizadoEm: new Date() }).where(eq(recados.id, id))
  } catch {
    return { erro: 'Erro ao excluir recado.' }
  }

  revalidar()
  return {}
}

export async function toggleFixadoRecado(
  id: string,
  fixado: boolean
): Promise<{ erro?: string }> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  try {
    await db.update(recados).set({ fixado, atualizadoEm: new Date() }).where(eq(recados.id, id))
  } catch {
    return { erro: 'Erro ao atualizar recado.' }
  }

  revalidar()
  return {}
}
