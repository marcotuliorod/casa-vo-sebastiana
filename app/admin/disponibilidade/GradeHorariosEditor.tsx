'use client'

import { Fragment, useState, useTransition } from 'react'
import { toggleHorarioGrade, ativarNovoSlot } from '@/lib/actions/admin'
import { cn } from '@/lib/utils/cn'
import type { GradeHorario } from '@/types/database'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_PADRAO = [2, 3, 4, 5, 6] // Ter a Sáb

type Turno = 'todos' | 'manha' | 'tarde' | 'noite'

const TURNOS: { id: Turno; label: string; descricao: string }[] = [
  { id: 'todos', label: 'Todos', descricao: '06:00 – 22:00' },
  { id: 'manha', label: 'Manhã', descricao: '06:00 – 12:00' },
  { id: 'tarde', label: 'Tarde', descricao: '12:00 – 18:00' },
  { id: 'noite', label: 'Noite', descricao: '18:00 – 22:00' },
]

function getSlotTurno(hora: string): Turno {
  const h = parseInt(hora.split(':')[0], 10)
  if (h < 12) return 'manha'
  if (h < 18) return 'tarde'
  return 'noite'
}

function gerarTodosSlots(): Array<{ inicio: string; fim: string }> {
  const slots = []
  for (let h = 6; h < 22; h++) {
    for (const m of [0, 30]) {
      const inicio = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const fimMin = h * 60 + m + 30
      const fim = `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`
      slots.push({ inicio, fim })
    }
  }
  return slots
}

const TODOS_SLOTS = gerarTodosSlots()

interface GradeHorariosEditorProps {
  grade: GradeHorario[]
}

export function GradeHorariosEditor({ grade }: GradeHorariosEditorProps) {
  const [turno, setTurno] = useState<Turno>('todos')
  const [isPending, startTransition] = useTransition()

  const slotMap = new Map<string, GradeHorario>()
  for (const g of grade) {
    slotMap.set(`${g.dia_semana}_${g.hora_inicio}`, g)
  }

  const diasComSlots = new Set(grade.map((g) => g.dia_semana))
  const diasMostrar = [...new Set([...DIAS_PADRAO, ...diasComSlots])].sort()

  const slotsVisiveis = TODOS_SLOTS.filter(
    (s) => turno === 'todos' || getSlotTurno(s.inicio) === turno
  )

  const handleClick = (dia: number, slot: { inicio: string; fim: string }) => {
    if (isPending) return
    const existente = slotMap.get(`${dia}_${slot.inicio}`)
    startTransition(async () => {
      if (existente) {
        await toggleHorarioGrade(existente.id, !existente.ativo)
      } else {
        await ativarNovoSlot(dia, slot.inicio, slot.fim)
      }
    })
  }

  const numDias = diasMostrar.length

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Filtro de turno */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 mr-1">Filtrar por turno:</span>
        {TURNOS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTurno(t.id)}
            title={t.descricao}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              turno === t.id
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
            )}
          >
            {t.label}
            <span
              className={cn(
                'ml-1 font-normal',
                turno === t.id ? 'text-purple-200' : 'text-gray-400'
              )}
            >
              {t.descricao}
            </span>
          </button>
        ))}
      </div>

      {/* Grade */}
      <div className="overflow-x-auto">
        <div
          className="p-4"
          style={{
            display: 'grid',
            gridTemplateColumns: `60px repeat(${numDias}, minmax(72px, 1fr))`,
            gap: '3px',
            minWidth: `${60 + numDias * 80}px`,
          }}
        >
          {/* Cabeçalho: dias da semana */}
          <div />
          {diasMostrar.map((dia) => (
            <div
              key={dia}
              className="text-xs font-semibold text-gray-500 uppercase text-center py-1"
            >
              {DIAS[dia]}
            </div>
          ))}

          {/* Linhas: um slot por linha */}
          {slotsVisiveis.map((slot) => (
            <Fragment key={slot.inicio}>
              {/* Rótulo do horário */}
              <div className="text-xs text-gray-400 text-right pr-2 flex items-center justify-end h-7 tabular-nums">
                {slot.inicio}
              </div>

              {/* Botão por dia */}
              {diasMostrar.map((dia) => {
                const existente = slotMap.get(`${dia}_${slot.inicio}`)
                const ausente = !existente
                const ativo = existente?.ativo === true

                return (
                  <button
                    key={`${dia}_${slot.inicio}`}
                    onClick={() => handleClick(dia, slot)}
                    disabled={isPending}
                    className={cn(
                      'h-7 w-full rounded text-xs font-medium transition-all border',
                      ausente
                        ? 'bg-white text-gray-300 border-dashed border-gray-200 hover:border-purple-300 hover:text-purple-400 hover:bg-purple-50'
                        : ativo
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-400 border-gray-200 line-through hover:bg-gray-100',
                      isPending && 'opacity-60 cursor-not-allowed'
                    )}
                    title={
                      ausente
                        ? `Adicionar ${slot.inicio}–${slot.fim}`
                        : ativo
                        ? `Desativar ${slot.inicio}`
                        : `Reativar ${slot.inicio}`
                    }
                  >
                    {ausente ? '+' : slot.inicio}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="px-4 py-3 flex items-center gap-5 text-xs text-gray-500 border-t bg-gray-50 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-green-200 border border-green-300 flex-shrink-0" />
          Ativo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-gray-200 border border-gray-300 flex-shrink-0" />
          Inativo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-white border-2 border-dashed border-gray-300 flex-shrink-0" />
          Não configurado — clique <strong>+</strong> para adicionar
        </span>
      </div>
    </div>
  )
}
