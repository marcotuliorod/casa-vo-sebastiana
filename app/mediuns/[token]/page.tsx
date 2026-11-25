// Área pessoal do médium — acesso via link privado por token
import { notFound } from 'next/navigation'
import { getMediumPorToken, getAgendamentosDoMedium, getAgendamentosDisponiveisMedium } from '@/lib/queries/mediuns'
import { listarRecados } from '@/lib/queries/recados'
import { MediumActions } from './MediumActions'
import { MuralRecados } from './MuralRecados'
import { formatarDataExtenso } from '@/lib/utils/date'
import { formatarTelefone } from '@/lib/utils/phone'
import type { AgendamentoComCliente } from '@/types/database'

interface Props {
  params: Promise<{ token: string }>
}

// Primeiro nome, para os atendimentos ainda sem médium
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? ''
}

// `completo`: só o médium que assumiu o atendimento vê nome completo, telefone
// e observações (como diz a política de privacidade). Nos disponíveis para
// assumir aparecem só data, horário e primeiro nome.
function CardAgendamento({
  ag,
  acao,
  completo,
}: {
  ag: AgendamentoComCliente
  acao: React.ReactNode
  completo: boolean
}) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="font-semibold text-gray-900 capitalize">
          {formatarDataExtenso(ag.data_agendada)}
        </p>
        <p className="text-sm text-purple-700 font-medium">
          {ag.hora_inicio.slice(0, 5)} — {ag.hora_fim.slice(0, 5)}
        </p>
        <p className="text-sm text-gray-600">
          {completo ? ag.clientes.nome : primeiroNome(ag.clientes.nome)}
        </p>
        {completo && (
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">{formatarTelefone(ag.clientes.telefone)}</p>
            <a
              href={`https://wa.me/${ag.clientes.telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 hover:underline"
            >
              WhatsApp ↗
            </a>
          </div>
        )}
        {completo && ag.notas && (
          <p className="text-xs text-gray-400 italic">{ag.notas}</p>
        )}
      </div>
      <div className="flex-shrink-0">{acao}</div>
    </div>
  )
}

export default async function MediumPage({ params }: Props) {
  const { token } = await params
  const medium = await getMediumPorToken(token)

  if (!medium) notFound()

  const [meus, disponiveis, recados] = await Promise.all([
    getAgendamentosDoMedium(medium.id),
    getAgendamentosDisponiveisMedium(),
    listarRecados(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <p className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">
            Casa de Vó Sebastiana
          </p>
          <h1 className="text-xl font-serif font-bold text-gray-900">
            Olá, {medium.nome}
          </h1>
          {medium.especialidade && (
            <p className="text-sm text-gray-500 mt-0.5">{medium.especialidade}</p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Mural de recados */}
        <MuralRecados recados={recados} />

        {/* Meus atendimentos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">
              Meus atendimentos
            </h2>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {meus.length} próximo{meus.length !== 1 ? 's' : ''}
            </span>
          </div>

          {meus.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
              <p className="text-gray-400 text-sm">Nenhum atendimento assumido ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meus.map((ag) => (
                <CardAgendamento
                  key={ag.id}
                  ag={ag}
                  completo
                  acao={
                    <MediumActions
                      agendamentoId={ag.id}
                      mediumToken={token}
                      tipo="liberar"
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Disponíveis para assumir */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">
              Disponíveis para assumir
            </h2>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {disponiveis.length} disponível{disponiveis.length !== 1 ? 'is' : ''}
            </span>
          </div>

          {disponiveis.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
              <p className="text-gray-400 text-sm">Nenhum atendimento disponível no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {disponiveis.map((ag) => (
                <CardAgendamento
                  key={ag.id}
                  ag={ag}
                  completo={false}
                  acao={
                    <MediumActions
                      agendamentoId={ag.id}
                      mediumToken={token}
                      tipo="assumir"
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
        Guarde este link com cuidado — ele é seu acesso pessoal.
      </footer>
    </div>
  )
}
