import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/** Rodapé das páginas públicas: nome da Casa e link para a Política de Privacidade. */
export function RodapePublico({ className }: { className?: string }) {
  return (
    <footer className={cn('py-6 text-center text-xs text-gray-500', className)}>
      Casa de Vó Sebastiana · Umbanda ·{' '}
      <Link href="/privacidade" className="inline-block py-2 underline underline-offset-2 hover:text-gray-700">
        Privacidade
      </Link>
    </footer>
  )
}
