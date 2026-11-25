'use server'

// "Meus Agendamentos": o consulente informa o e-mail e recebe um link de acesso.
// O histórico nunca abre só com um dado digitado (antes era o telefone, que
// qualquer pessoa pode saber) — só com o link que chega na caixa de entrada.

import { after } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getNomeClientePorEmail } from '@/lib/queries/appointments'
import { COOKIE_HISTORICO, gerarTokenHistorico } from '@/lib/historico/token'
import { enviarEmail } from '@/lib/email/cliente'
import { emailLinkHistorico } from '@/lib/email/templates'

const schemaEmail = z.string().trim().min(1, 'Informe seu e-mail').email('E-mail inválido').toLowerCase()

export type EstadoSolicitarHistorico =
  | { erro: string }
  | { enviadoPara: string }
  | null

/**
 * Envia o link do histórico se houver consulente com o e-mail informado.
 *
 * A resposta é a mesma exista ou não o cadastro, e o envio roda depois da
 * resposta (after), para que nem o texto nem o tempo de resposta revelem quem
 * é consulente da Casa.
 *
 * O link não vai para a fila de reenvio: ele expira em 1 hora, e quem não
 * recebeu pode simplesmente pedir de novo.
 */
export async function solicitarLinkHistorico(
  _estado: EstadoSolicitarHistorico,
  formData: FormData
): Promise<EstadoSolicitarHistorico> {
  const resultado = schemaEmail.safeParse(formData.get('email') ?? '')
  if (!resultado.success) {
    return { erro: resultado.error.issues[0].message }
  }
  const email = resultado.data

  after(async () => {
    try {
      const nome = await getNomeClientePorEmail(email)
      if (!nome) return

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
      const url = `${baseUrl}/historico/acesso?t=${encodeURIComponent(gerarTokenHistorico(email))}`
      const envio = await enviarEmail([email], emailLinkHistorico({ nomeCliente: nome, url }))
      if (!envio.sucesso) console.error('[Histórico] Resend recusou o link:', envio.erro)
    } catch (err) {
      console.error('[Histórico] Falha ao enviar o link:', err)
    }
  })

  return { enviadoPara: email }
}

/** Encerra o acesso ao histórico neste aparelho (apaga o cookie). */
export async function sairDoHistorico(): Promise<void> {
  const jar = await cookies()
  jar.delete({ name: COOKIE_HISTORICO, path: '/historico' })
  redirect('/historico')
}
