// Passo 3: Preencher dados e confirmar
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ProgressSteps } from '@/components/booking/ProgressSteps'
import { BookingForm } from '@/components/booking/BookingForm'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { formatarDataExtenso, ehDataPassada } from '@/lib/utils/date'
import { verificarSlotEspecifico } from '@/lib/queries/availability'

interface Props {
  searchParams: Promise<{
    data?: string
    hora_inicio?: string
    hora_fim?: string
  }>
}

export const metadata = {
  title: 'Confirmar Agendamento | Casa de Vó Sebastiana',
}

export default async function ConfirmarPage({ searchParams }: Props) {
  const params = await searchParams
  const { data, hora_inicio, hora_fim } = params

  // Validar que os parâmetros necessários estão presentes
  if (!data || !hora_inicio || !hora_fim) notFound()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) notFound()
  if (!/^\d{2}:\d{2}$/.test(hora_inicio)) notFound()

  // US-15: redirecionar se data passada (não exibir formulário para datas inválidas)
  if (ehDataPassada(data)) redirect('/agendar')

  // US-09: verificar se o slot ainda está disponível (RES-01: 1 query em vez de 3)
  const slotDisponivel = await verificarSlotEspecifico(data, hora_inicio, hora_fim)

  if (!slotDisponivel) {
    return (
      <div>
        <ProgressSteps passoAtual={3} />
        <div className="rounded-2xl bg-white p-8 shadow-sm border text-center">
          <p className="text-3xl">⏰</p>
          <p className="mt-2 font-medium text-gray-700">
            Este horário foi ocupado enquanto você preenchia o formulário.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Por favor, escolha outro horário disponível.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={`/agendar/${data}`}>← Voltar ao passo 2</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <ProgressSteps passoAtual={3} />

      <div className="rounded-2xl bg-white p-6 shadow-sm border">
        {/* Navegação de volta */}
        <Link
          href={`/agendar/${data}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-purple-700 mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Link>

        <h2 className="text-xl font-serif font-semibold text-purple-900 mb-1">
          Seus dados
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Preencha para confirmar seu atendimento.
        </p>

        <BookingForm
          data={data}
          horaInicio={hora_inicio}
          horaFim={hora_fim}
        />
      </div>
    </div>
  )
}
