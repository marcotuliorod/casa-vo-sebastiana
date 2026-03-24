import Link from 'next/link'
import { Calendar, CalendarRange, Clock } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-lg mx-auto w-full space-y-8">

        {/* Identidade */}
        <div className="text-center space-y-2">
          <p className="text-4xl">🕯️</p>
          <p className="text-xs font-medium uppercase tracking-widest text-purple-500">
            Bem-vindo à
          </p>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Casa de Vó Sebastiana
          </h1>
          <p className="text-base text-gray-600 leading-relaxed">
            Um espaço de acolhimento espiritual, fé e cura pela tradição da Umbanda.
          </p>
        </div>

        {/* Ações principais */}
        <div className="w-full space-y-3">
          <Link
            href="/agendar"
            className="flex items-center gap-4 w-full bg-purple-600 text-white px-5 py-4 rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Calendar className="h-5 w-5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-semibold">Agendar atendimento</p>
              <p className="text-sm text-purple-200">Escolha data e horário disponível</p>
            </div>
          </Link>

          <Link
            href="/agendar/eventos"
            className="flex items-center gap-4 w-full bg-white border border-purple-200 text-purple-900 px-5 py-4 rounded-xl hover:bg-purple-50 transition-colors shadow-sm"
          >
            <CalendarRange className="h-5 w-5 flex-shrink-0 text-purple-600" />
            <div className="text-left">
              <p className="font-semibold">Participar de um evento</p>
              <p className="text-sm text-gray-500">Ver eventos abertos para inscrição</p>
            </div>
          </Link>
        </div>

        {/* Ação terciária */}
        <Link
          href="/historico"
          className="flex items-center gap-2 text-sm text-purple-500 hover:text-purple-700 hover:underline transition-colors"
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
