// Passo 1: Escolha a data
import { ProgressSteps } from '@/components/booking/ProgressSteps'
import { CalendarioAgendamento } from './CalendarioAgendamento'
import { getDatasBlockeadas } from '@/lib/queries/availability'

export const metadata = {
  title: 'Agendar — Escolha a data | Casa de Vó Sebastiana',
}

export default async function AgendarPage() {
  const datasBlockeadas = await getDatasBlockeadas()

  return (
    <div>
      <ProgressSteps passoAtual={1} />

      <div className="rounded-2xl bg-white p-6 shadow-sm border">
        <h2 className="text-xl font-serif font-semibold text-purple-900 mb-1">
          Escolha uma data
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Selecione o dia em que deseja ser atendido(a).
        </p>

        <CalendarioAgendamento datasBlockeadas={datasBlockeadas} />
      </div>
    </div>
  )
}
