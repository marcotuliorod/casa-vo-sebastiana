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
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="text-center mb-8">
          <Logo size="sm" href="/" />
        </div>

        {/* Banner: aguardando confirmação */}
        {agendamento.status === 'pendente' && (
          <div className="mb-6 rounded-xl bg-brand-areia border border-brand-muted/40 p-4 text-center">
            <p className="font-semibold text-brand-dark">🕐 Agendamento recebido!</p>
            <p className="text-sm text-brand mt-1">
              Aguardando confirmação da Casa. Você receberá uma mensagem no WhatsApp em breve.
            </p>
          </div>
        )}

        {/* Card de sucesso para agendamentos confirmados */}
        {agendamento.status === 'confirmado' && (
          <div className="mb-6 rounded-xl bg-brand-green/20 border border-brand-green p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-brand-success mx-auto mb-2" />
            <p className="font-semibold text-gray-800">Agendamento confirmado!</p>
            <p className="text-sm text-gray-600">
              Você receberá uma confirmação via WhatsApp.
            </p>
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-serif font-semibold text-brand-dark">
                Seu Agendamento
              </h1>
              <StatusBadge status={agendamento.status} />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <User className="h-4 w-4 text-brand-muted flex-shrink-0" />
                <span>{agendamento.clientes.nome}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="h-4 w-4 text-brand-muted flex-shrink-0" />
                <span>{formatarTelefone(agendamento.clientes.telefone)}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="h-4 w-4 text-brand-muted flex-shrink-0" />
                <span className="capitalize">{formatarDataExtenso(agendamento.data_agendada)}</span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="h-4 w-4 text-brand-muted flex-shrink-0" />
                <span>
                  {agendamento.hora_inicio} — {agendamento.hora_fim}
                </span>
              </div>

              {mediumNome && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Sparkles className="h-4 w-4 text-brand-gold flex-shrink-0" />
                  <span>Atendimento com: {mediumNome}</span>
                </div>
              )}
            </div>

            {agendamento.notas && (
              <div className="rounded-lg bg-brand-areia/40 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Observações:</p>
                <p>{agendamento.notas}</p>
              </div>
            )}

            {agendamento.status === 'cancelado' && agendamento.motivo_cancelamento && (
              <div className="rounded-lg bg-brand-error/10 p-3 text-sm text-brand-error">
                <p className="font-medium mb-1">Motivo do cancelamento:</p>
                <p>{agendamento.motivo_cancelamento}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="mt-4 space-y-3">
          {podeCancel && (
            <Button asChild variant="outline" className="w-full text-brand-error border-brand-error/30 hover:bg-brand-error/10">
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
            <Button asChild className="w-full bg-brand hover:bg-brand-hover">
              <Link href="/agendar">Reagendar ✨</Link>
            </Button>
          )}

          {agendamento.status === 'cancelado' && (
            <Button asChild className="w-full bg-brand hover:bg-brand-hover">
              <Link href="/agendar">Fazer novo agendamento ✨</Link>
            </Button>
          )}
        </div>

        {/* Link de volta ao histórico quando navegou por lá */}
        {from === 'historico' && (
          <div className="mt-4 text-center">
            <Link href="/historico" className="text-xs text-brand hover:underline">
              ← Meu histórico de agendamentos
            </Link>
          </div>
        )}

        {/* Link de volta à home sempre visível */}
        <div className="mt-3 text-center">
          <Link href="/" className="text-xs text-gray-400 hover:text-brand hover:underline transition-colors">
            ← Página inicial
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          🌿 Casa de Vó Sebastiana — Umbanda & Atendimento Espiritual
        </p>
      </div>
    </div>
  )
}
