'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { format, isBefore, startOfDay, addDays } from 'date-fns'
import 'react-day-picker/style.css'
import { DIAS_ANTECEDENCIA_AGENDAMENTO, primeiraMaiuscula } from '@/lib/utils/date'

const NOMES_DIAS: Record<number, string> = {
  0: 'domingo', 1: 'segunda', 2: 'terça', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sábado',
}

interface CalendarioProps {
  datasBlockeadas: string[]    // 'YYYY-MM-DD'
  diasComAtendimento: number[] // dias da semana ativos (BUG-03)
  datasComSlots: string[]      // datas com pelo menos 1 slot livre (BUG-04)
}

export function CalendarioAgendamento({ datasBlockeadas, diasComAtendimento, datasComSlots }: CalendarioProps) {
  const router = useRouter()
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>()
  const hoje = startOfDay(new Date())

  const bloqueadasSet = new Set(datasBlockeadas)
  const comSlotsSet = new Set(datasComSlots)

  const ehDesabilitado = (data: Date) => {
    if (isBefore(data, hoje)) return true
    if (!diasComAtendimento.includes(data.getDay())) return true
    if (bloqueadasSet.has(format(data, 'yyyy-MM-dd'))) return true
    if (!comSlotsSet.has(format(data, 'yyyy-MM-dd'))) return true
    return false
  }

  const handleSelecionarData = (data: Date | undefined) => {
    setDataSelecionada(data)
    if (!data) return
    const dataStr = format(data, 'yyyy-MM-dd')
    router.push(`/agendar/${dataStr}`)
  }

  return (
    <div>
      <div className="flex justify-center">
        {/* react-day-picker v9: estilo padrão (style.css) com as cores da marca via variáveis --rdp-* */}
        <div
          className="[&_.rdp-caption_label]:capitalize [&_.rdp-day_button:not(:disabled):hover]:bg-brand-light"
          style={
            {
              '--rdp-accent-color': '#2D69AA', // brand
              '--rdp-accent-background-color': '#EEF5FB', // brand-light
              '--rdp-today-color': '#1A4A7C', // brand-dark
              // 44px: alvo de toque confortável no celular (7 colunas cabem em 320px)
              '--rdp-day-height': '2.75rem',
              '--rdp-day-width': '2.75rem',
              '--rdp-day_button-height': '2.625rem',
              '--rdp-day_button-width': '2.625rem',
              '--rdp-disabled-opacity': '0.35',
            } as React.CSSProperties
          }
        >
          <DayPicker
            mode="single"
            selected={dataSelecionada}
            onSelect={handleSelecionarData}
            locale={ptBR}
            disabled={[ehDesabilitado, { before: hoje }, { after: addDays(hoje, DIAS_ANTECEDENCIA_AGENDAMENTO) }]}
            startMonth={hoje}
            endMonth={addDays(hoje, DIAS_ANTECEDENCIA_AGENDAMENTO)}
            modifiers={{ livre: (data: Date) => !ehDesabilitado(data) }}
            modifiersClassNames={{
              livre: '[&>button]:bg-brand-light [&>button]:font-semibold [&>button]:text-brand-dark',
              selected: '[&>button]:!bg-brand [&>button]:!text-white [&>button]:border-brand',
              today: 'font-bold',
            }}
          />
        </div>
      </div>

      {dataSelecionada && (
        <div className="mt-4">
          <p className="text-center text-sm text-brand font-medium">
            📅 {primeiraMaiuscula(format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR }))}
          </p>
          <p className="text-center text-xs text-gray-500 mt-1">Carregando horários...</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded bg-brand-light border border-brand-muted" aria-hidden="true" />
          com horário livre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border border-gray-200 opacity-50" aria-hidden="true" />
          sem horário
        </span>
      </div>
      {diasComAtendimento.length > 0 && (
        <p className="mt-2 text-center text-xs text-gray-600">
          Dias de atendimento:{' '}
          {[...diasComAtendimento].sort((a, b) => a - b).map((d) => NOMES_DIAS[d]).join(', ')}
        </p>
      )}
    </div>
  )
}
