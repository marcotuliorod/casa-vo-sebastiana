// Histórico de agendamentos do consulente — acesso público por telefone
import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { getHistoricoCliente } from '@/lib/queries/appointments'
import { formatarDataExtenso } from '@/lib/utils/date'
import { normalizarTelefone, validarTelefone } from '@/lib/utils/phone'
import { Calendar, Clock, Sparkles, Search } from 'lucide-react'

export const metadata = {
  title: 'Meus Agendamentos | Casa de Vó Sebastiana',
}

interface Props {
  searchParams: Promise<{ tel?: string }>
}

export default async function HistoricoPage({ searchParams }: Props) {
  const { tel } = await searchParams

  const telefone = tel?.trim() ?? ''
  const telefonValido = telefone && validarTelefone(telefone)
  const agendamentos = telefonValido
    ? await getHistoricoCliente(normalizarTelefone(telefone))
    : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-background to-background">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="text-center mb-8">
          <Logo size="sm" />
          <h1 className="mt-4 text-xl font-serif font-semibold text-purple-900">
            Meus Agendamentos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Informe seu telefone para ver seu histórico
          </p>
        </div>

        {/* Formulário de busca */}
        <form method="GET" className="flex gap-2 mb-8">
          <input
            type="tel"
            name="tel"
            defaultValue={telefone}
            placeholder="(11) 99999-9999"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            <Search className="h-4 w-4" />
            Buscar
          </button>
        </form>

        {/* Resultados */}
        {agendamentos === null ? null : agendamentos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-gray-500 text-sm">
              Nenhum agendamento encontrado para este telefone.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 text-right">
              {agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''} encontrado{agendamentos.length !== 1 ? 's' : ''}
            </p>
            {agendamentos.map((ag) => (
              <Link
                key={ag.id}
                href={`/agendamento/${ag.token_publico}`}
                className="block bg-white rounded-xl border p-4 hover:border-purple-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                      <span className="capitalize font-medium">
                        {formatarDataExtenso(ag.data_agendada)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                      <span>{ag.hora_inicio} — {ag.hora_fim}</span>
                    </div>
                    {ag.medium_id && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Sparkles className="h-3 w-3 text-purple-300 flex-shrink-0" />
                        <span>Atendimento com médium</span>
                      </div>
                    )}
                  </div>
                  <StatusBadge status={ag.status} />
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
          🌿 Casa de Vó Sebastiana — Umbanda & Atendimento Espiritual
        </p>
        <div className="mt-3 text-center">
          <Link href="/agendar" className="text-xs text-purple-600 hover:underline">
            Fazer novo agendamento →
          </Link>
        </div>
      </div>
    </div>
  )
}
