'use client'

import { useTransition } from 'react'
import { toggleHorarioGrade } from '@/lib/actions/admin'
import { cn } from '@/lib/utils/cn'
import type { GradeHorario } from '@/types/database'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface GradeHorariosEditorProps {
  grade: GradeHorario[]
}

export function GradeHorariosEditor({ grade }: GradeHorariosEditorProps) {
  const [, startTransition] = useTransition()

  const handleToggle = (id: string, ativo: boolean) => {
    startTransition(async () => {
      await toggleHorarioGrade(id, !ativo)
    })
  }

  // Agrupar por dia da semana
  const porDia = DIAS.map((_, dia) => ({
    dia,
    horarios: grade.filter((g) => g.dia_semana === dia),
  })).filter((d) => d.horarios.length > 0)

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <div className="flex gap-4 p-4 min-w-[600px]">
          {porDia.map(({ dia, horarios }) => (
            <div key={dia} className="flex-1 min-w-[100px]">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 text-center">
                {DIAS[dia]}
              </h3>
              <div className="space-y-1.5">
                {horarios.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => handleToggle(h.id, h.ativo)}
                    className={cn(
                      'w-full rounded-md px-2 py-1.5 text-xs font-medium transition-all border',
                      h.ativo
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-400 border-gray-200 line-through hover:bg-gray-100'
                    )}
                    title={h.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                  >
                    {h.hora_inicio}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {porDia.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4 w-full">
              Nenhum horário configurado.
            </p>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center gap-4 text-xs text-gray-500 border-t bg-gray-50">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-200 border border-green-300" />
          Ativo
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-200 border border-gray-300" />
          Inativo
        </span>
        <span>Clique para alternar</span>
      </div>
    </div>
  )
}
