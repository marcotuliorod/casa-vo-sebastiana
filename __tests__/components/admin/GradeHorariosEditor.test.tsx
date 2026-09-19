import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const toggleHorarioGrade = vi.fn()
const ativarNovoSlot = vi.fn()
vi.mock('@/lib/actions/admin', () => ({
  toggleHorarioGrade: (...args: unknown[]) => toggleHorarioGrade(...args),
  ativarNovoSlot: (...args: unknown[]) => ativarNovoSlot(...args),
}))

import { GradeHorariosEditor } from '@/app/admin/disponibilidade/GradeHorariosEditor'
import type { GradeHorario } from '@/types/database'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

beforeEach(() => {
  vi.clearAllMocks()
  toggleHorarioGrade.mockResolvedValue({})
  ativarNovoSlot.mockResolvedValue({})
})

describe('GradeHorariosEditor', () => {
  it('mostra os 7 dias da semana mesmo com a grade vazia', () => {
    render(<GradeHorariosEditor grade={[]} />)

    for (const dia of DIAS) {
      expect(screen.getByText(dia)).toBeTruthy()
    }
  })

  it('mostra Domingo e Segunda mesmo quando só há horários de outros dias', () => {
    const grade: GradeHorario[] = [
      { id: 'g1', dia_semana: 2, hora_inicio: '09:00:00', hora_fim: '09:30:00', ativo: true },
    ]
    render(<GradeHorariosEditor grade={grade} />)

    expect(screen.getByText('Dom')).toBeTruthy()
    expect(screen.getByText('Seg')).toBeTruthy()
  })

  it('clicar em "+" no Domingo cria o horário com dia_semana 0', async () => {
    render(<GradeHorariosEditor grade={[]} />)

    // Primeira linha (06:00): as 7 colunas em ordem Dom..Sáb; o primeiro "+" é o Domingo.
    fireEvent.click(screen.getAllByTitle('Adicionar 06:00–06:30')[0])

    await waitFor(() => expect(ativarNovoSlot).toHaveBeenCalledWith(0, '06:00', '06:30'))
  })

  it('horário inativo existente na Segunda pode ser reativado', async () => {
    const grade: GradeHorario[] = [
      { id: 'seg-9', dia_semana: 1, hora_inicio: '09:00:00', hora_fim: '09:30:00', ativo: false },
    ]
    render(<GradeHorariosEditor grade={grade} />)

    fireEvent.click(screen.getByTitle('Reativar 09:00'))

    await waitFor(() => expect(toggleHorarioGrade).toHaveBeenCalledWith('seg-9', true))
  })
})
