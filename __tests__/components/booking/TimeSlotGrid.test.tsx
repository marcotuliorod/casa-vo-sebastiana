import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TimeSlotGrid } from '@/components/booking/TimeSlotGrid'

// next/link renderiza <a> no jsdom
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const SLOTS = [
  { hora_inicio: '09:00', hora_fim: '10:00' },
  { hora_inicio: '10:00', hora_fim: '11:00' },
  { hora_inicio: '14:00', hora_fim: '15:00' },
]

describe('TimeSlotGrid', () => {
  // ─── Estado vazio ────────────────────────────────────────────
  describe('quando slots=[] (sem horários disponíveis)', () => {
    it('renderiza mensagem de sem horários', () => {
      render(<TimeSlotGrid slots={[]} data="2025-03-25" />)
      expect(screen.getByText(/não há horários disponíveis/i)).toBeInTheDocument()
    })

    it('exibe link para voltar ao calendário', () => {
      render(<TimeSlotGrid slots={[]} data="2025-03-25" />)
      const link = screen.getByRole('link', { name: /voltar/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/agendar')
    })

    it('não renderiza nenhum slot de horário', () => {
      render(<TimeSlotGrid slots={[]} data="2025-03-25" />)
      expect(screen.queryByText('09:00')).not.toBeInTheDocument()
    })
  })

  // ─── Com slots disponíveis ────────────────────────────────────
  describe('quando há slots disponíveis', () => {
    it('renderiza o número correto de links/slots', () => {
      render(<TimeSlotGrid slots={SLOTS} data="2025-03-25" />)
      // 3 slots = 3 links
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(3)
    })

    it('exibe hora de início de cada slot', () => {
      render(<TimeSlotGrid slots={SLOTS} data="2025-03-25" />)
      expect(screen.getByText('09:00')).toBeInTheDocument()
      expect(screen.getByText('10:00')).toBeInTheDocument()
      expect(screen.getByText('14:00')).toBeInTheDocument()
    })

    it('exibe hora de fim de cada slot com "até"', () => {
      render(<TimeSlotGrid slots={SLOTS} data="2025-03-25" />)
      expect(screen.getByText('até 10:00')).toBeInTheDocument()
      expect(screen.getByText('até 11:00')).toBeInTheDocument()
      expect(screen.getByText('até 15:00')).toBeInTheDocument()
    })

    it('cada link aponta para URL correta com data, hora_inicio, hora_fim', () => {
      render(<TimeSlotGrid slots={[SLOTS[0]]} data="2025-03-25" />)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute(
        'href',
        '/agendar/confirmar?data=2025-03-25&hora_inicio=09:00&hora_fim=10:00'
      )
    })

    it('não exibe mensagem de "sem horários"', () => {
      render(<TimeSlotGrid slots={SLOTS} data="2025-03-25" />)
      expect(screen.queryByText(/não há horários disponíveis/i)).not.toBeInTheDocument()
    })
  })

  // ─── Seleção de slot ──────────────────────────────────────────
  describe('slot selecionado (slotSelecionado prop)', () => {
    it('aplica classe de destaque ao slot selecionado', () => {
      render(
        <TimeSlotGrid slots={SLOTS} data="2025-03-25" slotSelecionado="09:00" />
      )
      // O link do slot 09:00 deve ter a classe de seleção
      const links = screen.getAllByRole('link')
      const linkSelecionado = links.find((l) => l.textContent?.includes('09:00'))
      expect(linkSelecionado).toHaveClass('border-purple-600')
    })

    it('slots não selecionados têm classe de borda padrão', () => {
      render(
        <TimeSlotGrid slots={SLOTS} data="2025-03-25" slotSelecionado="09:00" />
      )
      const links = screen.getAllByRole('link')
      // links[0] = 09:00 (selecionado), links[1] = 10:00 (não selecionado)
      const linkNaoSelecionado = links[1]
      expect(linkNaoSelecionado).not.toHaveClass('border-purple-600')
      expect(linkNaoSelecionado).toHaveClass('border-gray-200')
    })

    it('sem slotSelecionado, todos os slots têm estilo padrão', () => {
      render(<TimeSlotGrid slots={SLOTS} data="2025-03-25" />)
      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link).not.toHaveClass('border-purple-600')
      })
    })
  })

  // ─── Edge Cases ───────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('renderiza corretamente com um único slot', () => {
      render(<TimeSlotGrid slots={[SLOTS[0]]} data="2025-03-25" />)
      expect(screen.getByText('09:00')).toBeInTheDocument()
      expect(screen.getAllByRole('link')).toHaveLength(1)
    })

    it('data é passada corretamente para as URLs dos slots', () => {
      render(<TimeSlotGrid slots={[SLOTS[0]]} data="2025-12-31" />)
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', expect.stringContaining('data=2025-12-31'))
    })
  })
})
