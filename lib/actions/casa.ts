'use server'

// Salva as informações da Casa (tela /admin/casa).

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { configuracoesCasa } from '@/lib/db/schema'
import { verificarAdmin } from '@/lib/auth/admin'
import { mensagemErro } from '@/lib/db/errors'

export type EstadoFormCasa = { erro?: string; campo?: string; ok?: boolean } | null

// Texto opcional: vazio vira null
const texto = (max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo}: no máximo ${max} caracteres`)
    .transform((v) => v || null)

const schemaCasa = z.object({
  endereco: texto(300, 'Endereço'),
  link_mapa: texto(500, 'Link do mapa').refine(
    (v) => v === null || /^https:\/\/\S+$/.test(v),
    'Link do mapa: cole o endereço completo, começando com https://'
  ),
  email_contato: texto(254, 'E-mail').refine(
    (v) => v === null || z.email().safeParse(v).success,
    'E-mail de contato inválido'
  ),
  telefone_contato: texto(30, 'Telefone'),
  orientacoes: texto(2000, 'Orientações'),
  politica_cancelamento: texto(1000, 'Política de cancelamento'),
  responsavel_dados: texto(200, 'Responsável pelos dados'),
})

export async function salvarInfoCasa(_estado: EstadoFormCasa, formData: FormData): Promise<EstadoFormCasa> {
  const erroAuth = await verificarAdmin()
  if (erroAuth) return { erro: erroAuth }

  const campos = Object.keys(schemaCasa.shape)
  const dados = Object.fromEntries(campos.map((c) => [c, String(formData.get(c) ?? '')]))
  const resultado = schemaCasa.safeParse(dados)
  if (!resultado.success) {
    const primeiro = resultado.error.issues[0]
    return { erro: primeiro.message, campo: String(primeiro.path[0]) }
  }

  const v = resultado.data
  const valores = {
    endereco: v.endereco,
    linkMapa: v.link_mapa,
    emailContato: v.email_contato?.toLowerCase() ?? null,
    telefoneContato: v.telefone_contato,
    orientacoes: v.orientacoes,
    politicaCancelamento: v.politica_cancelamento,
    responsavelDados: v.responsavel_dados,
    atualizadoEm: new Date(),
  }

  try {
    await db
      .insert(configuracoesCasa)
      .values({ id: 1, ...valores })
      .onConflictDoUpdate({ target: configuracoesCasa.id, set: valores })
  } catch (erro) {
    return { erro: mensagemErro(erro) }
  }

  revalidatePath('/admin/casa')
  return { ok: true }
}
