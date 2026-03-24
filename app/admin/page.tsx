// Dashboard principal do painel administrativo
import { formatInTimeZone } from 'date-fns-tz'
import { StatCard } from '@/components/admin/StatCard'
import { AppointmentTable } from '@/components/admin/AppointmentTable'
import { getEstatisticas, listarAgendamentos } from '@/lib/queries/appointments'
import { listarMediuns } from '@/lib/queries/mediuns'
import { Calendar, AlertCircle, Clock, TrendingUp } from 'lucide-react'

export const metadata = {
  title: 'Dashboard | Admin — Casa de Vó Sebastiana',
}

export default async function AdminDashboard() {
  const [stats, agendamentosHoje, mediuns] = await Promise.all([
    getEstatisticas(),
    listarAgendamentos({ data: formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd') }),
    listarMediuns(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do terreiro</p>
      </div>

      {/* Cards de estatísticas — clicáveis, filtram agendamentos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          titulo="Hoje"
          valor={stats.hoje}
          descricao="atendimentos"
          icone={Clock}
          cor="purple"
          href="/admin/agendamentos?periodo=hoje"
        />
        <StatCard
          titulo="Próximos 7 dias"
          valor={stats.semana}
          descricao="agendamentos"
          icone={Calendar}
          cor="amber"
          href="/admin/agendamentos?periodo=7dias"
        />
        <StatCard
          titulo="Este mês"
          valor={stats.mes}
          descricao="agendamentos"
          icone={TrendingUp}
          cor="green"
          href="/admin/agendamentos?periodo=mes"
        />
        <StatCard
          titulo="Pendentes"
          valor={stats.pendentes}
          descricao="aguardando confirmação"
          icone={AlertCircle}
          cor="amber"
          href="/admin/agendamentos?status=pendente"
        />
      </div>

      {/* Agendamentos de hoje */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Agendamentos de hoje
        </h2>
        <AppointmentTable agendamentos={agendamentosHoje} mediuns={mediuns} />
      </div>
    </div>
  )
}
