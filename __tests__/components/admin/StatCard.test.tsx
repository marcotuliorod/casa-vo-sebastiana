import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Calendar } from 'lucide-react'
import { StatCard } from '@/components/admin/StatCard'

const DEFAULT_PROPS = {
  titulo: 'Agendamentos hoje',
  valor: 42,
  icone: Calendar,
}

describe('StatCard', () => {
  // ─── Rendering ───────────────────────────────────────────────
  describe('Rendering', () => {
    it('renderiza sem erros', () => {
      render(<StatCard {...DEFAULT_PROPS} />)
      expect(screen.getByText('Agendamentos hoje')).toBeInTheDocument()
    })

    it('exibe o título corretamente', () => {
      render(<StatCard {...DEFAULT_PROPS} />)
      expect(screen.getByText('Agendamentos hoje')).toBeInTheDocument()
    })

    it('exibe o valor numérico', () => {
      render(<StatCard {...DEFAULT_PROPS} />)
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('renderiza o ícone passado via prop', () => {
      const { container } = render(<StatCard {...DEFAULT_PROPS} />)
      // Lucide icons renderizam como <svg>
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  // ─── Props ───────────────────────────────────────────────────
  describe('Props', () => {
    it('exibe descricao quando fornecida', () => {
      render(<StatCard {...DEFAULT_PROPS} descricao="esta semana" />)
      expect(screen.getByText('esta semana')).toBeInTheDocument()
    })

    it('NÃO renderiza descrição quando omitida', () => {
      render(<StatCard {...DEFAULT_PROPS} />)
      // descrição opcional — sem ela não deve aparecer nada extra
      expect(screen.queryByText('esta semana')).not.toBeInTheDocument()
    })

    it('usa cor padrão "purple" quando cor não informada', () => {
      const { container } = render(<StatCard {...DEFAULT_PROPS} />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-purple-50')
    })

    it('aplica cor green quando cor="green"', () => {
      const { container } = render(<StatCard {...DEFAULT_PROPS} cor="green" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-green-50')
    })

    it('aplica cor amber quando cor="amber"', () => {
      const { container } = render(<StatCard {...DEFAULT_PROPS} cor="amber" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-amber-50')
    })

    it('aplica cor blue quando cor="blue"', () => {
      const { container } = render(<StatCard {...DEFAULT_PROPS} cor="blue" />)
      const card = container.firstChild as HTMLElement
      expect(card).toHaveClass('bg-blue-50')
    })
  })

  // ─── Edge Cases ───────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('exibe valor zero corretamente', () => {
      render(<StatCard {...DEFAULT_PROPS} valor={0} />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('exibe valores grandes corretamente', () => {
      render(<StatCard {...DEFAULT_PROPS} valor={9999} />)
      expect(screen.getByText('9999')).toBeInTheDocument()
    })

    it('exibe título com acentos corretamente', () => {
      render(<StatCard {...DEFAULT_PROPS} titulo="Não compareceu" />)
      expect(screen.getByText('Não compareceu')).toBeInTheDocument()
    })
  })
})
