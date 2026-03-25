// Passo 2: Escolha o horário
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProgressSteps } from '@/components/booking/ProgressSteps'
import { TimeSlotGrid } from '@/components/booking/TimeSlotGrid'
import { getSlotsDisponiveis } from '@/lib/queries/availability'
import { formatarDataExtenso, ehDataPassada } from '@/lib/utils/date'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

interface Props {
  params: Promise<{ data: string }>
}

export async function generateMetadata({ params }: Props) {
  const { data } = await params
  return {
    title: `Horários em ${formatarDataExtenso(data)} | Casa de Vó Sebastiana`,
  }
}

export default async function HorariosPage({ params }: Props) {
  const { data } = await params

  // Validar formato da data
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) notFound()

  // Não permitir datas passadas
  if (ehDataPassada(data)) {
    return (
      <div>
        <ProgressSteps passoAtual={2} />
        <div className="rounded-2xl bg-white p-8 shadow-sm border text-center">
          <p className="text-3xl">⚠️</p>
          <p className="mt-2 font-medium text-gray-700">Esta data já passou.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/agendar">← Escolher outra data</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { slots, erro } = await getSlotsDisponiveis(data)

  return (
    <div>
      <ProgressSteps passoAtual={2} />

      <div className="rounded-2xl bg-white p-6 shadow-sm border">
        {/* Navegação de volta */}
        <Link
          href="/agendar"
          className="inline-flex items-center text-sm text-gray-500 hover:text-brand mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Link>

        <h2 className="text-xl font-serif font-semibold text-brand-dark mb-1">
          Escolha um horário
        </h2>
        <p className="text-sm text-gray-500 mb-6 capitalize">
          📅 {formatarDataExtenso(data)}
        </p>

        {erro ? (
          <div className="text-center py-8 text-brand-error text-sm">{erro}</div>
        ) : (
          <TimeSlotGrid slots={slots} data={data} />
        )}
      </div>
    </div>
  )
}
