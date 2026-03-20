import { cn } from '@/lib/utils/cn'
import { Check } from 'lucide-react'

interface ProgressStepsProps {
  passoAtual: 1 | 2 | 3
}

const passos = [
  { numero: 1, rotulo: 'Escolha a data' },
  { numero: 2, rotulo: 'Escolha o horário' },
  { numero: 3, rotulo: 'Confirme' },
]

export function ProgressSteps({ passoAtual }: ProgressStepsProps) {
  return (
    <nav aria-label="Passos do agendamento" className="mb-8">
      <ol className="flex items-center justify-center gap-0">
        {passos.map((passo, idx) => {
          const concluido = passo.numero < passoAtual
          const atual = passo.numero === passoAtual

          return (
            <li key={passo.numero} className="flex items-center">
              {/* Círculo do passo */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
                    concluido && 'border-purple-600 bg-purple-600 text-white',
                    atual && 'border-purple-600 bg-white text-purple-600',
                    !concluido && !atual && 'border-gray-300 bg-white text-gray-400'
                  )}
                >
                  {concluido ? <Check className="h-4 w-4" /> : passo.numero}
                </div>
                <span
                  className={cn(
                    'mt-1 text-xs font-medium',
                    atual ? 'text-purple-700' : 'text-gray-400'
                  )}
                >
                  {passo.rotulo}
                </span>
              </div>

              {/* Linha conectora */}
              {idx < passos.length - 1 && (
                <div
                  className={cn(
                    'mx-2 mb-4 h-0.5 w-12 sm:w-20 transition-colors',
                    passo.numero < passoAtual ? 'bg-purple-600' : 'bg-gray-200'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
