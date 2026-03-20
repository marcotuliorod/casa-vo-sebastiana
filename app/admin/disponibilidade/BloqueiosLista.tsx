'use client'

import { useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { bloquearData, desbloquearData } from '@/lib/actions/admin'
import { formatarData } from '@/lib/utils/date'
import type { DataBloqueada } from '@/types/database'
import { Trash2, Plus, Loader2 } from 'lucide-react'

function BotaoBloqueio() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
      Bloquear
    </Button>
  )
}

interface BloqueiosListaProps {
  bloqueios: DataBloqueada[]
}

export function BloqueiosLista({ bloqueios }: BloqueiosListaProps) {
  const [estado, action] = useFormState(bloquearData, null)
  const [, startTransition] = useTransition()

  const handleRemover = (id: string) => {
    startTransition(async () => {
      await desbloquearData(id)
    })
  }

  return (
    <div className="space-y-4">
      {/* Formulário para adicionar bloqueio */}
      <form action={action} className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Adicionar bloqueio</h3>

        {estado?.erro && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
            {estado.erro}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data *</label>
            <input
              type="date"
              name="data"
              required
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Início (opcional)</label>
            <input
              type="time"
              name="hora_inicio"
              step="1800"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fim (opcional)</label>
            <input
              type="time"
              name="hora_fim"
              step="1800"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Motivo</label>
            <input
              type="text"
              name="motivo"
              placeholder="ex: Feriado"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-40"
            />
          </div>
          <BotaoBloqueio />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Deixe início/fim em branco para bloquear o dia inteiro.
        </p>
      </form>

      {/* Lista de bloqueios */}
      {bloqueios.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-400">Nenhuma data bloqueada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bloqueios.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between bg-white rounded-lg border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {formatarData(b.data_bloqueada)}
                  {b.hora_inicio && (
                    <span className="text-gray-500 ml-2">
                      {b.hora_inicio}–{b.hora_fim}
                    </span>
                  )}
                  {!b.hora_inicio && (
                    <span className="ml-2 text-xs text-amber-600 font-normal">dia inteiro</span>
                  )}
                </p>
                {b.motivo && (
                  <p className="text-xs text-gray-500 mt-0.5">{b.motivo}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-600 hover:bg-red-50"
                onClick={() => handleRemover(b.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
