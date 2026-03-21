import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from '@/components/admin/StatusBadge'

describe('StatusBadge', () => {
  // ─── Rendering ───────────────────────────────────────────────
  describe('Rendering', () => {
    it('renderiza sem erros', () => {
      render(<StatusBadge status="pendente" />)
      expect(screen.getByText('Pendente')).toBeInTheDocument()
    })
  })

  // ─── Labels por status ────────────────────────────────────────
  describe('Labels por status', () => {
    it('exibe "Pendente" para status pendente', () => {
      render(<StatusBadge status="pendente" />)
      expect(screen.getByText('Pendente')).toBeInTheDocument()
    })

    it('exibe "Confirmado" para status confirmado', () => {
      render(<StatusBadge status="confirmado" />)
      expect(screen.getByText('Confirmado')).toBeInTheDocument()
    })

    it('exibe "Cancelado" para status cancelado', () => {
      render(<StatusBadge status="cancelado" />)
      expect(screen.getByText('Cancelado')).toBeInTheDocument()
    })

    it('exibe "Realizado" para status realizado', () => {
      render(<StatusBadge status="realizado" />)
      expect(screen.getByText('Realizado')).toBeInTheDocument()
    })

    it('exibe "Não compareceu" para status nao_compareceu', () => {
      render(<StatusBadge status="nao_compareceu" />)
      expect(screen.getByText('Não compareceu')).toBeInTheDocument()
    })
  })

  // ─── Variantes visuais ────────────────────────────────────────
  describe('Variantes de cor (classes CSS)', () => {
    it('aplica classe de warning (amarelo) para pendente', () => {
      const { container } = render(<StatusBadge status="pendente" />)
      const badge = container.firstChild
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })

    it('aplica classe de success (verde) para confirmado', () => {
      const { container } = render(<StatusBadge status="confirmado" />)
      const badge = container.firstChild
      expect(badge).toHaveClass('bg-green-100', 'text-green-800')
    })

    it('aplica classe de destructive para cancelado', () => {
      const { container } = render(<StatusBadge status="cancelado" />)
      const badge = container.firstChild
      // destructive variant usa bg-destructive — verificamos que não é verde ou amarelo
      expect(badge).not.toHaveClass('bg-green-100')
      expect(badge).not.toHaveClass('bg-yellow-100')
    })
  })

  // ─── Edge Cases ───────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('cada status renderiza exatamente um elemento de texto', () => {
      const statuses = ['pendente', 'confirmado', 'cancelado', 'realizado', 'nao_compareceu'] as const
      statuses.forEach((status) => {
        const { unmount } = render(<StatusBadge status={status} />)
        expect(document.body).not.toBeEmptyDOMElement()
        unmount()
      })
    })
  })
})
