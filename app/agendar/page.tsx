// Passo 1: Escolha a data
import Link from 'next/link'
import { CalendarRange, ChevronRight } from 'lucide-react'
import { ProgressSteps } from '@/components/booking/ProgressSteps'
import { CalendarioAgendamento } from './CalendarioAgendamento'
import { getDatasBlockeadas, getDiasAtivos, getDatasComSlotsDisponiveis } from '@/lib/queries/availability'
import { formatInTimeZone } from 'date-fns-tz'

export const metadata = {
  title: 'Agendar — Escolha a data | Casa de Vó Sebastiana',
}

export default async function AgendarPage() {
  // Gerar próximas 60 datas a partir de hoje no fuso de SP (RES-02)
  const hojeStr = formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd')
  const datasProximas: string[] = []
  for (let i = 0; i <= 60; i++) {
    const d = new Date(`${hojeStr}T12:00:00`)
    d.setDate(d.getDate() + i)
    datasProximas.push(formatInTimeZone(d, 'America/Sao_Paulo', 'yyyy-MM-dd'))
  }

  const [datasBlockeadas, diasAtivos, datasComSlots] = await Promise.all([
    getDatasBlockeadas(),
    getDiasAtivos(),
    getDatasComSlotsDisponiveis(datasProximas),
  ])

  return (
    <div>
      {/* Banner de acesso a eventos */}
      <Link
        href="/agendar/eventos"
        className="flex items-center gap-3 rounded-xl border bg-white p-4 mb-4 hover:bg-brand-light transition-colors shadow-sm"
      >
        <CalendarRange className="h-5 w-5 text-brand flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">Participar de um evento</p>
          <p className="text-xs text-gray-500">Ver eventos abertos para inscrição</p>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </Link>

      <ProgressSteps passoAtual={1} />

      <div className="rounded-2xl bg-white p-6 shadow-sm border">
        <h2 className="text-xl font-serif font-semibold text-brand-dark mb-1">
          Escolha uma data
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Selecione o dia em que deseja ser atendido(a).
        </p>

        <CalendarioAgendamento
          datasBlockeadas={datasBlockeadas}
          diasComAtendimento={diasAtivos}
          datasComSlots={datasComSlots}
        />
      </div>
    </div>
  )
}
