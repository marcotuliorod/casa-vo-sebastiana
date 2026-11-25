import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/actions/booking', () => ({ inscreverEmEvento: vi.fn() }))

import { EventoInscricaoForm } from '@/app/agendar/eventos/[id]/EventoInscricaoForm'

function ocorrencias(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    data: `2030-01-${String(i + 1).padStart(2, '0')}`,
    vagasRestantes: i === 0 ? 1 : 5,
  }))
}

function renderForm(n: number) {
  render(
    <EventoInscricaoForm
      eventoId="ev-1"
      tituloEvento="Gira"
      horaInicio="19:00:00"
      horaFim="21:00:00"
      ocorrencias={ocorrencias(n) as never}
    />
  )
}

describe('EventoInscricaoForm', () => {
  it('agrupa as datas com uma legenda e mostra as 8 primeiras', () => {
    renderForm(12)
    expect(screen.getByRole('group', { name: 'Escolha a data *' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(8)
  })

  it('"Mostrar mais" revela as demais datas', () => {
    renderForm(12)
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 4 datas' }))
    expect(screen.getAllByRole('radio')).toHaveLength(12)
    expect(screen.queryByRole('button', { name: /Mostrar mais/ })).not.toBeInTheDocument()
  })

  it('com poucas datas não mostra o botão', () => {
    renderForm(3)
    expect(screen.queryByRole('button', { name: /Mostrar mais/ })).not.toBeInTheDocument()
  })

  it('concordância de vagas e data com só a primeira letra maiúscula', () => {
    renderForm(2)
    expect(screen.getByText('1 vaga disponível')).toBeInTheDocument()
    expect(screen.getByText('5 vagas disponíveis')).toBeInTheDocument()
    expect(screen.getByText('Terça-feira, 1 de janeiro de 2030')).toBeInTheDocument()
  })

  it('formata o telefone enquanto a pessoa digita', () => {
    renderForm(1)
    const tel = screen.getByLabelText(/^Telefone/) as HTMLInputElement
    fireEvent.input(tel, { target: { value: '11987654321' } })
    expect(tel.value).toBe('(11) 98765-4321')
  })
})
