import { cn } from '@/lib/utils/cn'
import { tokenizarTexto } from '@/lib/utils/texto-formatado'

interface TextoFormatadoProps {
  texto: string
  className?: string
}

// Preserva quebras de linha (whitespace-pre-line) e aplica **negrito** / *itálico*.
export function TextoFormatado({ texto, className }: TextoFormatadoProps) {
  return (
    <div className={cn('whitespace-pre-line break-words', className)}>
      {tokenizarTexto(texto.trim()).map((segmento, i) => {
        if (segmento.tipo === 'negrito') return <strong key={i}>{segmento.valor}</strong>
        if (segmento.tipo === 'italico') return <em key={i}>{segmento.valor}</em>
        return <span key={i}>{segmento.valor}</span>
      })}
    </div>
  )
}
