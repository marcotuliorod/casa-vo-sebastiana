'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * Autorização de uso dos dados (LGPD, arts. 8º, 9º §3º, 11 I, 14 e 33 VIII): o pedido revela que a pessoa
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
          aria-describedby={erro ? 'consentimento-ajuda consentimento-erro' : 'consentimento-ajuda'}
          className="mt-0.5 h-5 w-5 flex-shrink-0 accent-brand-dark"
        />
        <label htmlFor="consentimento" className="text-sm leading-relaxed text-gray-700">
          Li a{' '}
          <Link href="/privacidade" target="_blank" className="font-medium text-brand-dark underline">
            Política de Privacidade
          </Link>{' '}
          e autorizo a Casa de Vó Sebastiana a guardar e usar meus dados (nome, telefone, e-mail e o
          que eu escrever nas observações) <strong>somente para organizar meu atendimento ou minha
          inscrição</strong>, incluindo os e-mails de confirmação e lembrete. Sei que isso mostra que
          procuro atendimento espiritual na Umbanda, uma informação que a lei protege de forma
          especial, e que alguns serviços usados pela Casa (servidor, e-mail e cópias de segurança)
          ficam fora do Brasil. Declaro ter 18 anos ou mais, ou ser o responsável legal pela pessoa
          atendida.
        </label>
      </div>
      <p id="consentimento-ajuda" className="text-xs text-gray-600">
        Sem esta autorização não conseguimos registrar o pedido. Você pode retirá-la quando quiser,
        pelo contato indicado na Política de Privacidade.
      </p>
      {erro && (
        <p id="consentimento-erro" role="alert" className="text-xs text-brand-error">
          {erro}
        </p>
      )}
    </div>
  )
}
