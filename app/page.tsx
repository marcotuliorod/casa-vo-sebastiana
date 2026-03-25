import Link from 'next/link'
import { Calendar, CalendarRange, Clock } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#A4D3EE]/20 via-white to-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-lg mx-auto w-full space-y-8">

        {/* Identidade visual */}
        <div className="text-center space-y-3">
          <Logo size="lg" className="mx-auto" />
          <p className="text-base text-gray-600 leading-relaxed mt-4">
            Um espaço de acolhimento espiritual, fé e cura<br className="hidden sm:block" /> pela tradição da Umbanda.
          </p>
        </div>

        {/* Ações principais */}
        <div className="w-full space-y-3">
          <Link
            href="/agendar"
            style={{ backgroundColor: '#191970' }}
            className="flex items-center gap-4 w-full text-white px-5 py-4 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
          >
            <Calendar className="h-5 w-5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-semibold">Agendar atendimento</p>
              <p className="text-sm text-[#A4D3EE]">Escolha data e horário disponível</p>
            </div>
          </Link>

          <Link
            href="/agendar/eventos"
            className="flex items-center gap-4 w-full bg-white border border-[#A4D3EE] text-[#191970] px-5 py-4 rounded-xl hover:bg-[#A4D3EE]/10 transition-colors shadow-sm"
          >
            <CalendarRange className="h-5 w-5 flex-shrink-0 text-[#191970]" />
            <div className="text-left">
              <p className="font-semibold">Participar de um evento</p>
              <p className="text-sm text-gray-500">Ver eventos abertos para inscrição</p>
            </div>
          </Link>
        </div>

        {/* Ação terciária */}
        <Link
          href="/historico"
          className="flex items-center gap-2 text-sm text-[#191970]/60 hover:text-[#191970] hover:underline transition-colors"
        >
          <Clock className="h-4 w-4" />
          Ver meus agendamentos
        </Link>

      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        Casa de Vó Sebastiana · Umbanda
      </footer>
    </div>
  )
}
