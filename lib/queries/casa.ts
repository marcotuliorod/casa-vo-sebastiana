// Informações da Casa (endereço, contato, orientações), editadas em /admin/casa.
// Campos vazios ficam null; quem exibe esconde o bloco correspondente.

import { cache } from 'react'
import { db } from '@/lib/db'
import { configuracoesCasa } from '@/lib/db/schema'

export interface InfoCasa {
  endereco: string | null
  linkMapa: string | null
  emailContato: string | null
  telefoneContato: string | null
  orientacoes: string | null
  politicaCancelamento: string | null
  responsavelDados: string | null
}

export const INFO_CASA_VAZIA: InfoCasa = {
  endereco: null,
  linkMapa: null,
  emailContato: null,
  telefoneContato: null,
  orientacoes: null,
  politicaCancelamento: null,
  responsavelDados: null,
}

/** Uma consulta por requisição; se o banco falhar, segue sem as informações (o site não cai). */
export const getInfoCasa = cache(async (): Promise<InfoCasa> => {
  try {
    const [linha] = await db.select().from(configuracoesCasa).limit(1)
    if (!linha) return INFO_CASA_VAZIA
    return {
      endereco: linha.endereco,
      linkMapa: linha.linkMapa,
      emailContato: linha.emailContato,
      telefoneContato: linha.telefoneContato,
      orientacoes: linha.orientacoes,
      politicaCancelamento: linha.politicaCancelamento,
      responsavelDados: linha.responsavelDados,
    }
  } catch (erro) {
    console.error('[Casa] Falha ao ler as informações da Casa:', erro instanceof Error ? erro.message : erro)
    return INFO_CASA_VAZIA
  }
})

/** E-mail de contato público: o da tela da Casa ou, na falta, o EMAIL_REPLY_TO do servidor. */
export function emailDeContato(info: InfoCasa): string | null {
  if (info.emailContato) return info.emailContato
  const valor = process.env.EMAIL_REPLY_TO?.trim()
  if (!valor) return null
  return valor.match(/<([^>]+)>/)?.[1] ?? valor
}
