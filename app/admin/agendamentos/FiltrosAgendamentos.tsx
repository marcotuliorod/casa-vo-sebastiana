'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import type { Medium } from '@/types/database'

const STATUS_OPTIONS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'confirmado', rotulo: 'Confirmado' },
  { valor: 'realizado', rotulo: 'Realizado' },
  { valor: 'nao_compareceu', rotulo: 'Não compareceu' },
  { valor: 'cancelado', rotulo: 'Cancelado' },
]

const PERIODO_OPTIONS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: '7dias', rotulo: '7 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
]

const TIPO_OPTIONS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'horario', rotulo: 'Horário' },
  { valor: 'evento', rotulo: 'Evento' },
]

interface FiltrosAgendamentosProps {
  mediuns?: Medium[]
}

export function FiltrosAgendamentos({ mediuns = [] }: FiltrosAgendamentosProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const buscaRef = useRef<HTMLInputElement>(null)
  const dataRef = useRef<HTMLInputElement>(null)

  const statusAtual = searchParams.get('status') ?? ''
  const dataAtual = searchParams.get('data') ?? ''
  const periodoAtual = searchParams.get('periodo') ?? ''
  const buscaAtual = searchParams.get('busca') ?? ''
  const mediumIdAtual = searchParams.get('medium_id') ?? ''
  const tipoAtual = searchParams.get('tipo') ?? ''

  const aplicarFiltro = (chave: string, valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) {
      params.set(chave, valor)
    } else {
      params.delete(chave)
    }
    router.push(`/admin/agendamentos?${params.toString()}`)
  }

  const aplicarPeriodo = (periodo: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('data')
    if (periodo) {
      params.set('periodo', periodo)
    } else {
      params.delete('periodo')
    }
    router.push(`/admin/agendamentos?${params.toString()}`)
  }

  const aplicarData = (data: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('periodo')
    if (data) {
      params.set('data', data)
    } else {
      params.delete('data')
    }
    router.push(`/admin/agendamentos?${params.toString()}`)
  }

  const handleBusca = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    aplicarFiltro('busca', buscaRef.current?.value ?? '')
  }

  const limparFiltros = () => {
    if (buscaRef.current) buscaRef.current.value = ''
    if (dataRef.current) dataRef.current.value = ''
    router.push('/admin/agendamentos')
  }

  const temFiltros = statusAtual || dataAtual || buscaAtual || periodoAtual || mediumIdAtual || tipoAtual

  return (
    <div className="space-y-3 bg-white rounded-xl p-4 border">

      {/* Linha 1: Atalhos de período + data específica */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-14 shrink-0">Período</span>
        <div className="flex flex-wrap gap-1.5">
          {PERIODO_OPTIONS.map((opt) => (
            <button
              key={opt.valor}
              onClick={() => aplicarPeriodo(periodoAtual === opt.valor ? '' : opt.valor)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                periodoAtual === opt.valor
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.rotulo}
            </button>
          ))}
        </div>
        <input
          ref={dataRef}
          type="date"
          value={dataAtual}
          onChange={(e) => aplicarData(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Linha 2: Filtro por status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-14 shrink-0">Status</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.valor}
              onClick={() => aplicarFiltro('status', opt.valor)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusAtual === opt.valor
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Linha 3: Busca + Médium + Tipo + Limpar */}
      <div className="flex flex-wrap items-center gap-3 pt-1 border-t">
        <form onSubmit={handleBusca} className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              ref={buscaRef}
              defaultValue={buscaAtual}
              placeholder="Nome ou telefone..."
              className="pl-8 h-9 w-48 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">Buscar</Button>
        </form>

        {mediuns.length > 0 && (
          <select
            value={mediumIdAtual}
            onChange={(e) => aplicarFiltro('medium_id', e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-gray-700"
          >
            <option value="">Todos os médiuns</option>
            {mediuns.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        )}

        <div className="flex gap-1.5">
          {TIPO_OPTIONS.map((opt) => (
            <button
              key={opt.valor}
              onClick={() => aplicarFiltro('tipo', opt.valor)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tipoAtual === opt.valor
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.rotulo}
            </button>
          ))}
        </div>

        {temFiltros && (
          <Button size="sm" variant="ghost" onClick={limparFiltros} className="text-gray-400 ml-auto">
            <X className="h-3 w-3 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
