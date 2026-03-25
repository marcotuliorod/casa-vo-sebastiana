import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CalendarRange } from 'lucide-react'
import { getEvento, getOcorrenciasEvento } from '@/lib/queries/eventos'
import { EventoInscricaoForm } from './EventoInscricaoForm'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const evento = await getEvento(params.id)
  if (!evento) return { title: 'Evento não encontrado' }
  return { title: `${evento.titulo} — Casa de Vó Sebastiana` }
}

export default async function EventoPage({ params }: PageProps) {
  const evento = await getEvento(params.id)

  if (!evento || !evento.ativo) {
    notFound()
  }

  const ocorrencias = await getOcorrenciasEvento(evento)

  return (
    <div>
      <div className="rounded-2xl bg-white p-6 shadow-sm border">
        <div className="flex items-start gap-3 mb-1">
          <CalendarRange className="h-6 w-6 text-brand flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-xl font-serif font-semibold text-brand-dark">
              {evento.titulo}
            </h2>
            {evento.descricao && (
              <p className="text-sm text-gray-500 mt-1">{evento.descricao}</p>
            )}
          </div>
        </div>

        <div className="mt-4 mb-6 pt-4 border-t">
          <EventoInscricaoForm
            eventoId={evento.id}
            tituloEvento={evento.titulo}
            horaInicio={evento.hora_inicio}
            horaFim={evento.hora_fim}
            ocorrencias={ocorrencias}
          />
        </div>

        <div className="pt-4 border-t">
          <Link href="/agendar/eventos" className="text-sm text-brand hover:underline">
            ← Voltar para eventos
          </Link>
        </div>
      </div>
    </div>
  )
}
