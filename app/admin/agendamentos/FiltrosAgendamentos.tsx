'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

const STATUS_OPTIONS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'confirmado', rotulo: 'Confirmado' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
  { valor: 'realizado', rotulo: 'Realizado' },
]

export function FiltrosAgendamentos() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const statusAtual = searchParams.get('status') ?? ''
  const dataAtual = searchParams.get('data') ?? ''

  const aplicarFiltro = (chave: string, valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) {
      params.set(chave, valor)
    } else {
      params.delete(chave)
    }
    router.push(`/admin/agendamentos?${params.toString()}`)
  }

  const limparFiltros = () => {
    router.push('/admin/agendamentos')
  }

  const temFiltros = statusAtual || dataAtual

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 border">
      {/* Filtro por data */}
      <input
        type="date"
        value={dataAtual}
        onChange={(e) => aplicarFiltro('data', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      {/* Filtro por status */}
      <div className="flex gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.valor}
            onClick={() => aplicarFiltro('status', opt.valor)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusAtual === opt.valor
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.rotulo}
          </button>
        ))}
      </div>

      {/* Limpar filtros */}
      {temFiltros && (
        <Button size="sm" variant="ghost" onClick={limparFiltros} className="text-gray-400">
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  )
}
