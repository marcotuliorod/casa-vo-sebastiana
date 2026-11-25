import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { CalendarioAgendamento } from '@/app/agendar/CalendarioAgendamento'

describe('CalendarioAgendamento', () => {
  it('legenda descreve o destaque dos dias com horário livre', () => {
    render(<CalendarioAgendamento datasBlockeadas={[]} diasComAtendimento={[1, 3]} datasComSlots={[]} />)
    expect(screen.getByText('com horário livre')).toBeInTheDocument()
    expect(screen.getByText('sem horário')).toBeInTheDocument()
  })

  it('lista os dias de atendimento por extenso e em ordem, sem alterar a lista recebida', () => {
    const dias = [6, 1, 3]
    render(<CalendarioAgendamento datasBlockeadas={[]} diasComAtendimento={dias} datasComSlots={[]} />)
    expect(screen.getByText(/Dias de atendimento: segunda, quarta, sábado/)).toBeInTheDocument()
    expect(dias).toEqual([6, 1, 3])
  })
})
