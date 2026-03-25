import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light to-white flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-sm">
        <Logo size="md" className="mx-auto" />
        <p className="text-gray-500 text-sm">
          Esta página não existe ou foi movida.
        </p>
        <Link
          href="/agendar"
          className="inline-block bg-brand text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-hover transition-colors text-sm"
        >
          Fazer um agendamento
        </Link>
      </div>
    </div>
  )
}
