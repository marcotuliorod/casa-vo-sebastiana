import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-purple-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-5xl">🕯️</p>
        <h1 className="text-xl font-serif font-bold text-gray-900">
          Casa de Vó Sebastiana
        </h1>
        <p className="text-gray-500 text-sm">
          Esta página não existe ou foi movida.
        </p>
        <Link
          href="/agendar"
          className="inline-block mt-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm"
        >
          Fazer um agendamento
        </Link>
      </div>
    </div>
  )
}
