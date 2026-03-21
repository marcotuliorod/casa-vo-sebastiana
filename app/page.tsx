import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-lg mx-auto space-y-6">
        <p className="text-4xl">🕯️</p>

        <div className="space-y-2">
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

        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          Agende sua consulta espiritual de forma simples e discreta, no horário que melhor se encaixar na sua rotina.
        </p>

        <Link
          href="/agendar"
          className="inline-block bg-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-sm"
        >
          Agendar atendimento
        </Link>

        <Link
          href="/historico"
          className="text-sm text-purple-500 hover:underline"
        >
          Ver meus agendamentos anteriores
        </Link>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        Casa de Vó Sebastiana · Umbanda
      </footer>
    </div>
  )
}
