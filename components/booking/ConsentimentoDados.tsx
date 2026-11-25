'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * Autorização de uso dos dados (LGPD, art. 11): o pedido revela que a pessoa
 * procura atendimento espiritual na Umbanda, informação sensível. Obrigatória,
 * conferida de novo no servidor e registrada com data no cadastro.
 */
export function ConsentimentoDados({ erro }: { erro?: string }) {
  const [marcado, setMarcado] = useState(false)
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border p-3',
          erro ? 'border-brand-error bg-brand-error/5' : 'border-gray-200 bg-white'
        )}
      >
        <input
          id="consentimento"
          name="consentimento"
          type="checkbox"
          value="sim"
          required
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? 'consentimento-erro' : undefined}
          className="mt-0.5 h-5 w-5 flex-shrink-0 accent-brand-dark"
        />
        <label htmlFor="consentimento" className="text-sm leading-relaxed text-gray-700">
          Autorizo a Casa de Vó Sebastiana a guardar e usar meus dados (nome, telefone, e-mail e
          observações), inclusive a informação de que procuro atendimento espiritual na Umbanda,
          somente para organizar meu atendimento, como explicado na{' '}
          <Link href="/privacidade" target="_blank" className="font-medium text-brand-dark underline">
            Política de Privacidade
          </Link>
          .
        </label>
      </div>
      {erro && (
        <p id="consentimento-erro" role="alert" className="text-xs text-brand-error">
          {erro}
        </p>
      )}
    </div>
  )
}
