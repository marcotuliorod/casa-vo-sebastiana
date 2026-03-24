import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  href?: string
}

export function Logo({ className, size = 'md', href }: LogoProps) {
  const sizes = {
    sm: { emoji: 'text-2xl', titulo: 'text-sm', subtitulo: 'text-xs' },
    md: { emoji: 'text-4xl', titulo: 'text-xl', subtitulo: 'text-sm' },
    lg: { emoji: 'text-6xl', titulo: 'text-3xl', subtitulo: 'text-base' },
  }

  const content = (
    <>
      <span className={cn('leading-none', sizes[size].emoji)}>🕯️</span>
      <div className="text-center">
        <p className={cn('font-serif font-bold text-purple-900', sizes[size].titulo)}>
          Casa de Vó Sebastiana
        </p>
        <p className={cn('text-amber-700 font-medium', sizes[size].subtitulo)}>
          Umbanda & Atendimento Espiritual
        </p>
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn('flex flex-col items-center gap-1 hover:opacity-80 transition-opacity', className)}>
        {content}
      </Link>
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {content}
    </div>
  )
}
