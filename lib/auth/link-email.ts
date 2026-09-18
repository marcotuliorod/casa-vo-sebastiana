// O link do magic link é de uso único. Clientes de e-mail e scanners de segurança
// abrem links (GET) automaticamente e gastariam o token antes do usuário clicar.
// Por isso o e-mail aponta para /auth/confirmar, que só consome o token depois de
// um clique explícito num botão (submit de formulário).

export function montarUrlDeConfirmacao(urlDoAuthJs: string): string {
  const original = new URL(urlDoAuthJs)
  const confirmacao = new URL('/auth/confirmar', original.origin)
  confirmacao.search = original.search
  return confirmacao.toString()
}

function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface SendVerificationParams {
  identifier: string
  url: string
  provider: { apiKey?: string; from?: string }
}

export async function enviarLinkDeAcesso({ identifier, url, provider }: SendVerificationParams) {
  const link = montarUrlDeConfirmacao(url)
  const linkHtml = escapeHtml(link)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: provider.from,
      to: identifier,
      subject: 'Seu link de acesso — Casa de Vó Sebastiana',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 12px">Acesso Administrativo</h2>
  <p>Clique no botão abaixo para entrar no painel da Casa de Vó Sebastiana.</p>
  <p style="margin:24px 0"><a href="${linkHtml}" style="background:#4A86C8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Continuar</a></p>
  <p style="color:#666;font-size:13px">Se você não pediu este acesso, ignore este e-mail.</p>
</div>`,
      text: `Acesso Administrativo — Casa de Vó Sebastiana\n\nAbra o link para continuar:\n${link}\n\nSe você não pediu este acesso, ignore este e-mail.`,
    }),
  })

  if (!res.ok) throw new Error('Resend error: ' + JSON.stringify(await res.json()))
}
