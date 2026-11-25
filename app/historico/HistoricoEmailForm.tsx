'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Mail, MailCheck } from 'lucide-react'
import { solicitarLinkHistorico } from '@/lib/actions/historico'

function BotaoEnviar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-60"
    >
      <Mail className="h-4 w-4" />
      {pending ? 'Enviando…' : 'Enviar link'}
    </button>
  )
}

export function HistoricoEmailForm() {
  const [estado, acao] = useActionState(solicitarLinkHistorico, null)

  if (estado && 'enviadoPara' in estado) {
    return (
      <div className="rounded-xl border border-brand-muted bg-white p-5 text-center mb-8" role="status">
        <MailCheck className="mx-auto h-8 w-8 text-brand mb-2" />
        <p className="text-sm text-gray-700">
          Se houver agendamentos com <strong className="break-all">{estado.enviadoPara}</strong>, enviamos
          um link para ver o histórico.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Confira a caixa de entrada e o spam. O link vale por 1 hora.
        </p>
      </div>
    )
  }

  return (
    <form action={acao} className="mb-8" noValidate>
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          aria-label="Seu e-mail"
          aria-invalid={Boolean(estado && 'erro' in estado)}
          placeholder="seu@email.com"
          inputMode="email"
          className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-brand-muted"
        />
        <BotaoEnviar />
      </div>
      {estado && 'erro' in estado && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {estado.erro}
        </p>
      )}
    </form>
  )
}
