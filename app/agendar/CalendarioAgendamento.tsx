'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { format, isBefore, startOfDay, addDays } from 'date-fns'
import 'react-day-picker/dist/style.css'

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
        <DayPicker
          mode="single"
          selected={dataSelecionada}
          onSelect={handleSelecionarData}
          locale={ptBR}
          disabled={ehDesabilitado}
          fromDate={hoje}
          toDate={addDays(hoje, 60)}
          modifiersClassNames={{
            selected: 'bg-purple-600 text-white rounded-full',
            today: 'font-bold text-purple-600',
            disabled: 'opacity-30 cursor-not-allowed',
          }}
          classNames={{
            months: 'flex flex-col',
            month: 'space-y-4',
            caption: 'flex justify-center pt-1 relative items-center',
            caption_label: 'text-sm font-medium capitalize',
            nav: 'space-x-1 flex items-center',
            nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
            table: 'w-full border-collapse space-y-1',
            head_row: 'flex',
            head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1 text-center',
            row: 'flex w-full mt-2',
            cell: 'flex-1 text-center text-sm p-0 relative',
            day: 'h-9 w-9 p-0 font-normal mx-auto flex items-center justify-center rounded-full hover:bg-purple-50 transition-colors',
            day_selected: 'bg-purple-600 text-white hover:bg-purple-600',
            day_today: 'font-bold',
            day_disabled: 'opacity-30',
          }}
        />
      </div>

      {dataSelecionada && (
        <div className="mt-4">
          <p className="text-center text-sm text-purple-700 font-medium">
            📅 {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-center text-xs text-gray-400 mt-1">Carregando horários...</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-600" />
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
