import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import type { SlotDisponivel } from '@/types/database'

interface TimeSlotGridProps {
  slots: SlotDisponivel[]
  data: string
  slotSelecionado?: string
}

export function TimeSlotGrid({ slots, data, slotSelecionado }: TimeSlotGridProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
        <p className="text-2xl">🌙</p>
        <p className="mt-2 text-gray-500">Nenhum horário disponível nesta data.</p>
        <p className="text-sm text-gray-400">Por favor, escolha outra data.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {slots.map((slot) => {
        const isSelecionado = slot.hora_inicio === slotSelecionado
        const href = `/agendar/confirmar?data=${data}&hora_inicio=${slot.hora_inicio}&hora_fim=${slot.hora_fim}`

        return (
          <Link
            key={slot.hora_inicio}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition-all hover:shadow-md active:scale-95',
              isSelecionado
                ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-md'
                : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50'
            )}
          >
            <span className="text-lg font-bold">{slot.hora_inicio}</span>
            <span className="text-xs text-gray-400">até {slot.hora_fim}</span>
          </Link>
        )
      })}
    </div>
  )
}
