'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { format, isBefore, startOfDay, addDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import 'react-day-picker/dist/style.css'

// Dias da semana disponíveis: Ter (2), Qua (3), Qui (4), Sex (5), Sáb (6)
const DIAS_COM_ATENDIMENTO = [2, 3, 4, 5, 6]

interface CalendarioProps {
  datasBlockeadas: string[] // 'YYYY-MM-DD'
}

export function CalendarioAgendamento({ datasBlockeadas }: CalendarioProps) {
  const router = useRouter()
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>()
  const hoje = startOfDay(new Date())

  const bloqueadasSet = new Set(datasBlockeadas)

  const ehDesabilitado = (data: Date) => {
    if (isBefore(data, hoje)) return true
    if (!DIAS_COM_ATENDIMENTO.includes(data.getDay())) return true
    if (bloqueadasSet.has(format(data, 'yyyy-MM-dd'))) return true
    return false
  }

  const handleSelecionarData = () => {
    if (!dataSelecionada) return
    const dataStr = format(dataSelecionada, 'yyyy-MM-dd')
    router.push(`/agendar/${dataStr}`)
  }

  return (
    <div>
      <div className="flex justify-center">
        <DayPicker
          mode="single"
          selected={dataSelecionada}
          onSelect={setDataSelecionada}
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
        <div className="mt-4 space-y-3">
          <p className="text-center text-sm text-purple-700 font-medium">
            📅 {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <Button
            size="lg"
            className="w-full bg-purple-700 hover:bg-purple-800"
            onClick={handleSelecionarData}
          >
            Ver horários disponíveis →
          </Button>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-gray-400">
        Atendimentos: terça a sábado
      </p>
    </div>
  )
}
