// Lista de todos os agendamentos com filtros
import { AppointmentTable } from '@/components/admin/AppointmentTable'
import { FiltrosAgendamentos } from './FiltrosAgendamentos'
import { listarAgendamentos } from '@/lib/queries/appointments'
import type { AppointmentStatus } from '@/types/database'

export const metadata = {
  title: 'Agendamentos | Admin — Casa de Vó Sebastiana',
}

interface Props {
  searchParams: Promise<{
    data?: string
    status?: AppointmentStatus
    busca?: string
  }>
}

export default async function AgendamentosPage({ searchParams }: Props) {
  const params = await searchParams
  const agendamentos = await listarAgendamentos({
    data: params.data,
    status: params.status,
    busca: params.busca,
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Agendamentos</h1>
        <p className="text-sm text-gray-500 mt-1">
          {agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''} encontrado{agendamentos.length !== 1 ? 's' : ''}
        </p>
      </div>

      <FiltrosAgendamentos />

      <AppointmentTable agendamentos={agendamentos} />
    </div>
  )
}
