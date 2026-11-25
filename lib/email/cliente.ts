// Cliente mínimo da API do Resend para os e-mails transacionais
// (confirmações, lembretes, cancelamentos e avisos à Casa).
// O magic link do login usa o provider do Auth.js (lib/auth/link-email.ts).

export interface EmailMontado {
  assunto: string
  texto: string
  html: string
}

export interface ResultadoEnvioEmail {
  sucesso: boolean
  idMensagem?: string
  erro?: string
}

/** Remetente: EMAIL_FROM, ou o mesmo do login (AUTH_EMAIL_FROM) se não houver um próprio. */
function remetente(): string | undefined {
  return process.env.EMAIL_FROM || process.env.AUTH_EMAIL_FROM || undefined
}

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && remetente())
}

/** Separa uma lista "a@x.com, b@y.com" em endereços. */
export function listaDeEmails(valor: string | null | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
}

export const TIMEOUT_RESEND_MS = 8000

/**
 * Envia um e-mail. Lança se o envio não estiver configurado (sem chave ou remetente);
 * falhas da API voltam como { sucesso: false }.
 */
export async function enviarEmail(
  para: string[],
  email: EmailMontado
): Promise<ResultadoEnvioEmail> {
  const apiKey = process.env.RESEND_API_KEY
  const from = remetente()
  if (!apiKey || !from) {
    throw new Error('E-mail: configure RESEND_API_KEY e EMAIL_FROM no .env')
  }

  const replyTo = process.env.EMAIL_REPLY_TO || undefined

  // Sem limite, um Resend lento prende o formulário do consulente; o erro cai na fila de reenvio.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_RESEND_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: para,
      subject: email.assunto,
      html: email.html,
      text: email.texto,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })

  const corpo = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string }
  if (!res.ok) {
    return { sucesso: false, erro: corpo.message ?? corpo.name ?? `HTTP ${res.status}` }
  }
  return { sucesso: true, idMensagem: corpo.id }
}
