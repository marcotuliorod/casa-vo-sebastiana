import { cn } from '@/lib/utils/cn'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizes = {
    sm: { emoji: 'text-2xl', titulo: 'text-sm', subtitulo: 'text-xs' },
    md: { emoji: 'text-4xl', titulo: 'text-xl', subtitulo: 'text-sm' },
    lg: { emoji: 'text-6xl', titulo: 'text-3xl', subtitulo: 'text-base' },
  }

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <span className={cn('leading-none', sizes[size].emoji)}>🕯️</span>
      <div className="text-center">
        <h1 className={cn('font-serif font-bold text-purple-900', sizes[size].titulo)}>
          Casa de Vó Sebastiana
        </h1>
        <p className={cn('text-amber-700 font-medium', sizes[size].subtitulo)}>
          Umbanda & Atendimento Espiritual
        </p>
      </div>
    </div>
  )
}
