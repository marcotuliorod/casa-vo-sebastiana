// Dashboard principal do painel administrativo
import { StatCard } from '@/components/admin/StatCard'
import { AppointmentTable } from '@/components/admin/AppointmentTable'
import { getEstatisticas } from '@/lib/queries/appointments'
import { listarAgendamentos } from '@/lib/queries/appointments'
import { Calendar, Users, Clock, TrendingUp } from 'lucide-react'

export const metadata = {
  title: 'Dashboard | Admin — Casa de Vó Sebastiana',
}

export default async function AdminDashboard() {
  const [stats, agendamentosHoje] = await Promise.all([
    getEstatisticas(),
    listarAgendamentos({ data: new Date().toISOString().split('T')[0] }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do terreiro</p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          titulo="Hoje"
          valor={stats.hoje}
          descricao="atendimentos"
          icone={Clock}
          cor="purple"
        />
        <StatCard
          titulo="Próximos 7 dias"
          valor={stats.semana}
          descricao="agendamentos"
          icone={Calendar}
          cor="amber"
        />
        <StatCard
          titulo="Este mês"
          valor={stats.mes}
          descricao="agendamentos"
          icone={TrendingUp}
          cor="green"
        />
        <StatCard
          titulo="Consulentes"
          valor={stats.totalClientes}
          descricao="cadastrados"
          icone={Users}
          cor="blue"
        />
      </div>

      {/* Agendamentos de hoje */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Agendamentos de hoje
        </h2>
        <AppointmentTable agendamentos={agendamentosHoje} />
      </div>
    </div>
  )
}
