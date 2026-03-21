'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/button'
import { atualizarStatusAgendamento, atribuirMedium } from '@/lib/actions/admin'
import { formatarData } from '@/lib/utils/date'
import { formatarTelefone as fmtPhone } from '@/lib/utils/phone'
import type { AgendamentoComCliente, AppointmentStatus, Medium } from '@/types/database'
import { Check, X, Loader2, Download } from 'lucide-react'

interface AppointmentTableProps {
  agendamentos: AgendamentoComCliente[]
  mediuns: Medium[]
}

function MediumSelect({
  agendamentoId,
  mediumId,
  mediuns,
}: {
  agendamentoId: string
  mediumId: string | null
  mediuns: Medium[]
}) {
  const [, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    startTransition(async () => {
      await atribuirMedium(agendamentoId, e.target.value)
    })
  }

  const ativos = mediuns.filter((m) => m.ativo)

  return (
    <select
      value={mediumId ?? ''}
      onChange={handleChange}
      className="text-xs rounded border border-gray-200 px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-400 max-w-[140px]"
    >
      <option value="">— sem médium</option>
      {ativos.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nome}
        </option>
      ))}
    </select>
  )
}

function ExportarCSVButton({ agendamentos, mediuns }: AppointmentTableProps) {
  const handleExport = () => {
    const headers = ['Data', 'Horário', 'Consulente', 'Telefone', 'Médium', 'Status']
    const rows = agendamentos.map((ag) => {
      const medium = mediuns.find((m) => m.id === ag.medium_id)?.nome ?? '—'
      return [
        ag.data_agendada,
        `${ag.hora_inicio}–${ag.hora_fim}`,
        ag.clientes.nome,
        ag.clientes.telefone,
        medium,
        ag.status,
      ]
    })
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agendamentos-${new Date().toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-1.5">
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </Button>
  )
}

export function AppointmentTable({ agendamentos, mediuns }: AppointmentTableProps) {
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleStatus = (id: string, novoStatus: AppointmentStatus) => {
    setAtualizando(id)
    startTransition(async () => {
      await atualizarStatusAgendamento(id, novoStatus)
      setAtualizando(null)
    })
  }

  if (agendamentos.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <p className="text-3xl">🕯️</p>
        <p className="mt-2 text-gray-500">Nenhum agendamento encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportarCSVButton agendamentos={agendamentos} mediuns={mediuns} />
      </div>
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Consulente</th>
            <th className="px-4 py-3 text-left">Data & Horário</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Médium</th>
            <th className="px-4 py-3 text-left">WhatsApp</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {agendamentos.map((ag) => (
            <tr key={ag.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900">{ag.clientes.nome}</p>
                <p className="text-xs text-gray-500">{fmtPhone(ag.clientes.telefone)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium">{formatarData(ag.data_agendada)}</p>
                <p className="text-xs text-gray-500">
                  {ag.hora_inicio} — {ag.hora_fim}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={ag.status} />
              </td>
              <td className="px-4 py-3">
                <MediumSelect
                  agendamentoId={ag.id}
                  mediumId={ag.medium_id}
                  mediuns={mediuns}
                />
              </td>
              <td className="px-4 py-3">
                <a
                  href={`https://wa.me/${ag.clientes.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline text-xs"
                >
                  Abrir chat ↗
                </a>
              </td>
              <td className="px-4 py-3 text-right">
                {atualizando === ag.id ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    {ag.status === 'pendente' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => handleStatus(ag.id, 'confirmado')}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Confirmar
                      </Button>
                    )}
                    {(ag.status === 'pendente' || ag.status === 'confirmado') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => handleStatus(ag.id, 'cancelado')}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    )}
                    {ag.status === 'confirmado' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatus(ag.id, 'realizado')}
                      >
                        Realizado
                      </Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  )
}
