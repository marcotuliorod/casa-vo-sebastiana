import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  href?: string
}

export function Logo({ className, size = 'md', href }: LogoProps) {
  // sm → horizontal (icon + text side-by-side) — compact for page headers
  // md/lg → vertical (icon above text) — centered hero/section headers
  const isHorizontal = size === 'sm'

  const heightClass = {
    sm: 'h-12',   // 48px
    md: 'h-20',   // 80px
    lg: 'h-28',   // 112px
  }[size]

  // Arquivos com 640 px de largura; `sizes` = largura exibida, para o navegador
  // baixar só o tamanho necessário (1x/2x/3x) em vez da imagem inteira.
  const imgProps = isHorizontal
    ? { src: '/logo-horizontal.png', width: 640, height: 357 }
    : { src: '/logo-vertical.png', width: 640, height: 349 }
  const larguraExibida = { sm: 86, md: 147, lg: 205 }[size]

  const content = (
    <Image
      {...imgProps}
      alt="Casa de Vó Sebastiana"
      preload
      sizes={`${larguraExibida}px`}
      className={cn('w-auto object-contain', heightClass)}
    />
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn('inline-flex items-center hover:opacity-80 transition-opacity', className)}
      >
        {content}
      </Link>
    )
  }

  return (
    <div className={cn('inline-flex items-center', className)}>
      {content}
    </div>
  )
}
