import { differenceInDays, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Recado, PrioridadeRecado } from '@/types/database'

const PRIORIDADE_CONFIG: Record<PrioridadeRecado, { label: string; cor: string; fundo: string; borda: string }> = {
  normal:     { label: '',           cor: '',               fundo: 'bg-white',    borda: 'border' },
  importante: { label: 'Importante', cor: 'text-amber-700', fundo: 'bg-amber-50', borda: 'border border-l-4 border-amber-400' },
  urgente:    { label: 'Urgente',    cor: 'text-red-700',   fundo: 'bg-red-50',   borda: 'border border-l-4 border-red-500' },
}

function CardRecado({ recado }: { recado: Recado }) {
  const cfg = PRIORIDADE_CONFIG[recado.prioridade]
  const ehNovo = differenceInDays(new Date(), parseISO(recado.criado_em)) <= 3
  const dataRelativa = formatDistanceToNow(parseISO(recado.criado_em), { locale: ptBR, addSuffix: true })

  return (
    <article className={cn('rounded-xl p-4 space-y-2', cfg.fundo, cfg.borda)}>
      <div className="flex items-start gap-2 flex-wrap">
        {recado.fixado && <Pin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />}
        <span className="font-semibold text-gray-900 text-sm leading-snug">{recado.titulo}</span>
        {recado.prioridade !== 'normal' && (
          <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.cor)}>
            {cfg.label}
          </span>
        )}
        {ehNovo && (
          <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 text-xs font-medium px-2 py-0.5">
            Novo
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {recado.conteudo}
      </p>

      <time
        dateTime={recado.criado_em}
        className="block text-xs text-gray-400"
        title={new Date(recado.criado_em).toLocaleString('pt-BR')}
      >
        {dataRelativa}
      </time>
    </article>
  )
}

export function MuralRecados({ recados }: { recados: Recado[] }) {
  if (recados.length === 0) return null

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-800 mb-3">Mural de Recados</h2>
      <div className="space-y-3">
        {recados.map((r) => (
          <CardRecado key={r.id} recado={r} />
        ))}
      </div>
    </section>
  )
}
