import Link from 'next/link'
import { RodapePublico } from '@/components/shared/RodapePublico'
import { Logo } from '@/components/shared/Logo'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light to-white flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-sm">
        <Logo size="md" className="mx-auto" />
        <p className="text-gray-500 text-sm">
          Esta página não existe ou foi movida.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/"
            className="inline-block bg-brand-dark text-white px-5 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity text-sm"
          >
            Ir para a página inicial
          </Link>
          <Link href="/agendar" className="inline-block py-2 text-sm text-brand-dark underline underline-offset-2">
            Fazer um agendamento
          </Link>
        </div>
        <RodapePublico />
      </div>
    </div>
  )
}
