// Histórico de agendamentos do consulente ("Meus Agendamentos").
// Só abre com o link enviado ao e-mail do consulente: o token do link fica num
// cookie httpOnly (app/historico/acesso/route.ts) e é validado aqui.
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Logo } from '@/components/shared/Logo'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { HistoricoEmailForm } from './HistoricoEmailForm'
import { getHistoricoPorEmail } from '@/lib/queries/appointments'
import { getMediunsNomesMap } from '@/lib/queries/mediuns'
import { sairDoHistorico } from '@/lib/actions/historico'
import { COOKIE_HISTORICO, verificarTokenHistorico } from '@/lib/historico/token'
import { formatarDataExtenso } from '@/lib/utils/date'
import { Calendar, Clock, Sparkles } from 'lucide-react'

export const metadata = {
  title: 'Meus Agendamentos | Casa de Vó Sebastiana',
}

interface Props {
  searchParams: Promise<{ link?: string }>
}

export default async function HistoricoPage({ searchParams }: Props) {
  const { link } = await searchParams
  const jar = await cookies()
  const acesso = verificarTokenHistorico(jar.get(COOKIE_HISTORICO)?.value)

  const agendamentos = acesso ? await getHistoricoPorEmail(acesso.email) : null

  // US-23: batch fetch nomes de médiuns para os cards
  const mediumIds = agendamentos
    ? Array.from(new Set(agendamentos.map((ag) => ag.medium_id).filter(Boolean) as string[]))
    : []
  const mediumNomes = await getMediunsNomesMap(mediumIds)

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="text-center mb-8">
          <Logo size="sm" href="/" />
          <h1 className="mt-4 text-xl font-serif font-semibold text-brand-dark">
            Meus Agendamentos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {acesso
              ? <>Agendamentos de <span className="break-all">{acesso.email}</span></>
              : 'Informe o e-mail usado no agendamento e enviaremos um link de acesso'}
          </p>
        </div>

        {!acesso && link === 'invalido' && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
            Este link expirou ou não é válido. Peça um novo abaixo.
          </p>
        )}

        {acesso ? (
          <form action={sairDoHistorico} className="mb-6 text-right">
            <button type="submit" className="text-xs text-gray-500 hover:text-brand hover:underline">
              Sair
            </button>
          </form>
        ) : (
          <HistoricoEmailForm />
        )}

        {/* Resultados */}
        {agendamentos === null ? null : agendamentos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-gray-500 text-sm">
              Nenhum agendamento encontrado para este e-mail.
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
                href={`/agendamento/${ag.token_publico}?from=historico`}
                className="block bg-white rounded-xl border p-4 hover:border-brand-muted transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="h-3.5 w-3.5 text-brand-muted flex-shrink-0" />
                      <span className="capitalize font-medium">
                        {formatarDataExtenso(ag.data_agendada)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-3.5 w-3.5 text-brand-muted flex-shrink-0" />
                      <span>{ag.hora_inicio.slice(0, 5)} — {ag.hora_fim.slice(0, 5)}</span>
                    </div>
                    {ag.medium_id && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Sparkles className="h-3 w-3 text-brand-gold flex-shrink-0" />
                        <span>Com: {mediumNomes[ag.medium_id] ?? 'Médium'}</span>
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
          <Link href="/agendar" className="text-xs text-brand hover:underline">
            Fazer novo agendamento →
          </Link>
        </div>
      </div>
    </div>
  )
}
