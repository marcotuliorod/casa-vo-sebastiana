'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { format, isBefore, startOfDay, addDays } from 'date-fns'
import 'react-day-picker/style.css'

const NOMES_DIAS: Record<number, string> = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb',
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
              '--rdp-accent-color': '#4A86C8', // brand
              '--rdp-accent-background-color': '#EEF5FB', // brand-light
              '--rdp-today-color': '#4A86C8',
              '--rdp-day-height': '2.25rem',
              '--rdp-day-width': '2.25rem',
              '--rdp-disabled-opacity': '0.3',
            } as React.CSSProperties
          }
        >
          <DayPicker
            mode="single"
            selected={dataSelecionada}
            onSelect={handleSelecionarData}
            locale={ptBR}
            disabled={[ehDesabilitado, { before: hoje }, { after: addDays(hoje, 60) }]}
            startMonth={hoje}
            endMonth={addDays(hoje, 60)}
            modifiersClassNames={{
              selected: '[&>button]:bg-brand [&>button]:text-white [&>button]:border-brand',
              today: 'font-bold',
            }}
          />
        </div>
      </div>

      {dataSelecionada && (
        <div className="mt-4">
          <p className="text-center text-sm text-brand font-medium">
            📅 {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-center text-xs text-gray-400 mt-1">Carregando horários...</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
          disponível
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-gray-300" />
          sem horário
        </span>
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">
        Atendimentos: {diasComAtendimento.sort((a, b) => a - b).map((d) => NOMES_DIAS[d]).join(', ')}
      </p>
    </div>
  )
}
