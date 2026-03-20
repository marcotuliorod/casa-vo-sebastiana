'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/button'
import { atualizarStatusAgendamento } from '@/lib/actions/admin'
import { formatarData } from '@/lib/utils/date'
import { formatarTelefone as fmtPhone } from '@/lib/utils/phone'
import type { AgendamentoComCliente, AppointmentStatus } from '@/types/database'
import { MoreHorizontal, Check, X, Loader2 } from 'lucide-react'

interface AppointmentTableProps {
  agendamentos: AgendamentoComCliente[]
}

export function AppointmentTable({ agendamentos }: AppointmentTableProps) {
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
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Consulente</th>
            <th className="px-4 py-3 text-left">Data & Horário</th>
            <th className="px-4 py-3 text-left">Status</th>
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
  )
}
