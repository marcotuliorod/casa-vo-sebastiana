// Página de detalhe do agendamento — acessível pelo token público, sem login
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAgendamentoPorToken } from '@/lib/queries/appointments'
import { getMediumNome } from '@/lib/queries/mediuns'
import { formatarDataExtenso } from '@/lib/utils/date'
import { formatarTelefone } from '@/lib/utils/phone'
import { Calendar, Clock, User, Phone, CheckCircle2, Sparkles } from 'lucide-react'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function AgendamentoPage({ params, searchParams }: Props) {
  const { token } = await params
  const { from } = await searchParams
  const agendamento = await getAgendamentoPorToken(token)

  if (!agendamento) notFound()

  const mediumNome = agendamento.medium_id
    ? await getMediumNome(agendamento.medium_id)
    : null

  const podeCancel =
    agendamento.status === 'pendente' || agendamento.status === 'confirmado'

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-background to-background">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="text-center mb-8">
          <Logo size="sm" />
        </div>

        {/* Banner: aguardando confirmação */}
        {agendamento.status === 'pendente' && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
            <p className="font-semibold text-amber-800">🕐 Agendamento recebido!</p>
            <p className="text-sm text-amber-600 mt-1">
              Aguardando confirmação da Casa. Você receberá uma mensagem no WhatsApp em breve.
            </p>
          </div>
        )}

        {/* Card de sucesso para agendamentos confirmados */}
        {agendamento.status === 'confirmado' && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-800">Agendamento confirmado!</p>
            <p className="text-sm text-green-600">
              Você receberá uma confirmação via WhatsApp.
            </p>
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-serif font-semibold text-purple-900">
                Seu Agendamento
              </h1>
              <StatusBadge status={agendamento.status} />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <User className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <span>{agendamento.clientes.nome}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <span>{formatarTelefone(agendamento.clientes.telefone)}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <span className="capitalize">{formatarDataExtenso(agendamento.data_agendada)}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <span>
                  {agendamento.hora_inicio} — {agendamento.hora_fim}
                </span>
              </div>

              {mediumNome && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Sparkles className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <span>Atendimento com: {mediumNome}</span>
                </div>
              )}
            </div>

            {agendamento.notas && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Observações:</p>
                <p>{agendamento.notas}</p>
              </div>
            )}

            {agendamento.status === 'cancelado' && agendamento.motivo_cancelamento && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <p className="font-medium mb-1">Motivo do cancelamento:</p>
                <p>{agendamento.motivo_cancelamento}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="mt-4 space-y-3">
          {podeCancel && (
            <Button asChild variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
              <Link href={`/agendamento/${token}/cancelar`}>
                Cancelar agendamento
              </Link>
            </Button>
          )}

          {agendamento.status === 'confirmado' && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/agendar">Fazer outro agendamento →</Link>
            </Button>
          )}

          {agendamento.status === 'realizado' && (
            <Button asChild className="w-full bg-purple-700 hover:bg-purple-800">
              <Link href="/agendar">Reagendar ✨</Link>
            </Button>
          )}

          {agendamento.status === 'cancelado' && (
            <Button asChild className="w-full bg-purple-700 hover:bg-purple-800">
              <Link href="/agendar">Fazer novo agendamento ✨</Link>
            </Button>
          )}
        </div>

        {/* US-24: link de volta ao histórico quando navegou por lá */}
        {from === 'historico' && (
          <div className="mt-4 text-center">
            <Link href="/historico" className="text-xs text-purple-600 hover:underline">
              ← Meu histórico de agendamentos
            </Link>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
          🌿 Casa de Vó Sebastiana — Umbanda & Atendimento Espiritual
        </p>
      </div>
    </div>
  )
}
