'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  addMonths,
  subMonths,
  parseISO,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ContagensPorDia } from '@/lib/queries/calendario'

interface CalendarioMesProps {
  contagens: ContagensPorDia
  mesInicial: string // 'YYYY-MM'
}

const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CalendarioMes({ contagens, mesInicial }: CalendarioMesProps) {
  const router = useRouter()
  const [mesAtual, setMesAtual] = useState(mesInicial)

  const mesData = useMemo(() => parseISO(mesAtual + '-01'), [mesAtual])
  const mesMaximo = useMemo(
    () => format(addMonths(parseISO(mesInicial + '-01'), 1), 'yyyy-MM'),
    [mesInicial]
  )

  const dias = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(mesData), end: endOfMonth(mesData) })
  }, [mesData])

  const offsetInicial = getDay(startOfMonth(mesData))
  const tituloMes = format(mesData, 'MMMM yyyy', { locale: ptBR })
  const mesAnterior = format(subMonths(mesData, 1), 'yyyy-MM')
  const proximoMes = format(addMonths(mesData, 1), 'yyyy-MM')

  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800 capitalize">{tituloMes}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setMesAtual(mesAnterior)}
            disabled={mesAtual <= mesInicial}
            aria-label="Mês anterior"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMesAtual(proximoMes)}
            disabled={mesAtual >= mesMaximo}
            aria-label="Próximo mês"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px">
        {/* Cabeçalho dos dias da semana */}
        {NOMES_DIAS.map((nome) => (
          <div key={nome} className="text-center text-xs font-medium text-gray-400 py-1">
            {nome}
          </div>
        ))}

        {/* Offset para o primeiro dia do mês */}
        {Array.from({ length: offsetInicial }).map((_, i) => (
          <div key={`vazio-${i}`} />
        ))}

        {/* Dias */}
        {dias.map((dia) => {
          const dataStr = format(dia, 'yyyy-MM-dd')
          const info = contagens[dataStr]
          const numAg = info?.agendamentos ?? 0
          const numEv = info?.eventos ?? 0
          const temConteudo = numAg > 0 || numEv > 0
          const ehHoje = isToday(dia)

          const partsAria: string[] = []
          if (numAg > 0) partsAria.push(`${numAg} agendamento${numAg !== 1 ? 's' : ''}`)
          if (numEv > 0) partsAria.push(`${numEv} evento${numEv !== 1 ? 's' : ''}`)
          const ariaLabel = `${format(dia, "d 'de' MMMM", { locale: ptBR })}${partsAria.length > 0 ? ' — ' + partsAria.join(', ') : ''}`

          return (
            <button
              key={dataStr}
              onClick={() => router.push(`/admin/agendamentos?data=${dataStr}`)}
              aria-label={ariaLabel}
              aria-current={ehHoje ? 'date' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-start py-1.5 rounded-lg transition-colors min-h-[36px] sm:min-h-[44px]',
                ehHoje ? 'bg-brand-light ring-1 ring-brand' : 'hover:bg-gray-50'
              )}
            >
              <span
                className={cn(
                  'text-xs sm:text-sm font-medium leading-none',
                  ehHoje ? 'text-brand' : 'text-gray-700'
                )}
              >
                {format(dia, 'd')}
              </span>

              {temConteudo && (
                <div className="flex gap-0.5 mt-1" aria-hidden="true">
                  {Array.from({ length: Math.min(numAg, 3) }).map((_, i) => (
                    <span key={`ag-${i}`} className="w-1 h-1 rounded-full bg-brand" />
                  ))}
                  {numEv > 0 && <span className="w-1 h-1 rounded-full bg-amber-400" />}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mt-3 justify-end" aria-hidden="true">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-brand inline-block" />
          Agendamento
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          Evento
        </span>
      </div>
    </div>
  )
}
