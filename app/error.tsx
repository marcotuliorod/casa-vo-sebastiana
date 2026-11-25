'use client'

// Erro inesperado numa página: mensagem em português e caminho de volta.
import { useEffect } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { RodapePublico } from '@/components/shared/RodapePublico'

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Página] Erro inesperado:', error.digest ?? error.message)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light to-white flex items-center justify-center px-4">
      <div role="alert" className="text-center space-y-5 max-w-sm">
        <Logo size="md" className="mx-auto" />
        <h1 className="text-lg font-serif font-semibold text-brand-dark">Algo não saiu como esperado</h1>
        <p className="text-gray-600 text-sm">
          Não foi possível carregar esta página agora. Tente de novo em alguns instantes.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-block bg-brand-dark text-white px-5 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity text-sm"
          >
            Tentar de novo
          </button>
          <Link href="/" className="inline-block py-2 text-sm text-brand-dark underline underline-offset-2">
            Ir para a página inicial
          </Link>
        </div>
        <RodapePublico />
      </div>
    </div>
  )
}
