import Link from 'next/link'
import { CalendarRange, ChevronRight, Users } from 'lucide-react'
import { listarEventosAtivos, getOcorrenciasEvento } from '@/lib/queries/eventos'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const metadata = {
  title: 'Eventos — Casa de Vó Sebastiana',
}

export default async function EventosPublicosPage() {
  const eventos = await listarEventosAtivos()

  const eventosComOcorrencias = await Promise.all(
    eventos.map(async (evento) => ({
      evento,
      ocorrencias: await getOcorrenciasEvento(evento),
    }))
  )

  // Filtra apenas eventos com ocorrências futuras disponíveis
  const eventosDisponiveis = eventosComOcorrencias.filter(
    ({ ocorrencias }) => ocorrencias.length > 0
  )

  return (
    <div>
      <div className="rounded-2xl bg-white p-6 shadow-sm border">
        <div className="flex items-center gap-3 mb-1">
          <CalendarRange className="h-6 w-6 text-brand flex-shrink-0" />
          <h2 className="text-xl font-serif font-semibold text-brand-dark">Eventos</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Inscreva-se nos eventos abertos da Casa de Vó Sebastiana.
        </p>

        {eventosDisponiveis.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CalendarRange className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum evento disponível no momento.</p>
            <p className="text-xs mt-1">Volte em breve!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventosDisponiveis.map(({ evento, ocorrencias }) => {
              const proximaOcorrencia = ocorrencias[0]
              const totalVagas = ocorrencias.reduce((s, o) => s + o.vagasRestantes, 0)

              return (
                <Link
                  key={evento.id}
                  href={`/agendar/eventos/${evento.id}`}
                  className="flex items-start gap-4 rounded-xl border p-4 hover:bg-brand-light hover:border-brand-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{evento.titulo}</p>

                    {evento.descricao && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {evento.descricao}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>
                        🕐 {evento.hora_inicio.slice(0, 5)} — {evento.hora_fim.slice(0, 5)}
                      </span>
                      {proximaOcorrencia && (
                        <span>
                          📅 Próximo:{' '}
                          {format(parseISO(proximaOcorrencia.data), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      <span className={totalVagas === 0 ? 'text-brand-error' : 'text-brand-success'}>
                        <Users className="inline h-3 w-3 mr-0.5" />
                        {totalVagas === 0
                          ? 'Esgotado'
                          : `${totalVagas} vaga${totalVagas !== 1 ? 's' : ''} disponível`}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <Link
            href="/agendar"
            className="text-sm text-brand hover:underline"
          >
            ← Agendar por horário
          </Link>
        </div>
      </div>
    </div>
  )
}
