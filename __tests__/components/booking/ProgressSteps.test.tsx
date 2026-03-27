import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProgressSteps } from '@/components/booking/ProgressSteps'

describe('ProgressSteps', () => {
  // ─── Rendering ───────────────────────────────────────────────
  describe('Rendering', () => {
    it('renderiza sem erros', () => {
      render(<ProgressSteps passoAtual={1} />)
      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })

    it('renderiza exatamente 3 passos', () => {
      render(<ProgressSteps passoAtual={1} />)
      const itens = screen.getAllByRole('listitem')
      expect(itens).toHaveLength(3)
    })

    it('exibe os rótulos dos 3 passos', () => {
      render(<ProgressSteps passoAtual={1} />)
      expect(screen.getByText('Escolha a data')).toBeInTheDocument()
      expect(screen.getByText('Escolha o horário')).toBeInTheDocument()
      expect(screen.getByText('Confirme')).toBeInTheDocument()
    })

    it('nav tem aria-label de acessibilidade', () => {
      render(<ProgressSteps passoAtual={1} />)
      expect(screen.getByRole('navigation', { name: /passos/i })).toBeInTheDocument()
    })
  })

  // ─── Estado: passo 1 ──────────────────────────────────────────
  describe('passoAtual=1 (primeiro passo)', () => {
    it('mostra número 1 visível (passo atual)', () => {
      render(<ProgressSteps passoAtual={1} />)
      // Passo 1 é o atual — exibe o número, não check
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('mostra números 2 e 3 para passos futuros', () => {
      render(<ProgressSteps passoAtual={1} />)
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('não exibe nenhum ícone check (nenhum passo concluído)', () => {
      render(<ProgressSteps passoAtual={1} />)
      // Ícone Check do lucide-react renderiza como <svg> com um path específico
      // — sem passo concluído, nenhum check deve aparecer
      expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument()
    })
  })

  // ─── Estado: passo 2 ──────────────────────────────────────────
  describe('passoAtual=2 (segundo passo)', () => {
    it('mostra ícone check para o passo 1 (concluído)', () => {
      const { container } = render(<ProgressSteps passoAtual={2} />)
      // Passo 1 concluído → renderiza <Check /> (svg) dentro do círculo
      const svgs = container.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThanOrEqual(1) // pelo menos o check do passo 1
    })

    it('mostra número 2 (passo atual)', () => {
      render(<ProgressSteps passoAtual={2} />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('mostra número 3 (passo futuro)', () => {
      render(<ProgressSteps passoAtual={2} />)
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('rótulo do passo 2 tem estilo de item ativo', () => {
      render(<ProgressSteps passoAtual={2} />)
      const rotulo = screen.getByText('Escolha o horário')
      expect(rotulo).toHaveClass('text-brand')
    })

    it('rótulos de passos não ativos não têm text-brand', () => {
      render(<ProgressSteps passoAtual={2} />)
      const rotulo1 = screen.getByText('Escolha a data')
      const rotulo3 = screen.getByText('Confirme')
      expect(rotulo1).not.toHaveClass('text-brand')
      expect(rotulo3).not.toHaveClass('text-brand')
    })
  })

  // ─── Estado: passo 3 ──────────────────────────────────────────
  describe('passoAtual=3 (terceiro passo)', () => {
    it('mostra número 3 (passo atual)', () => {
      render(<ProgressSteps passoAtual={3} />)
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('rótulo do passo 3 tem estilo de item ativo', () => {
      render(<ProgressSteps passoAtual={3} />)
      expect(screen.getByText('Confirme')).toHaveClass('text-brand')
    })

    it('dois checks renderizados para passos 1 e 2 concluídos', () => {
      const { container } = render(<ProgressSteps passoAtual={3} />)
      const svgs = container.querySelectorAll('svg')
      // Passos 1 e 2 concluídos → 2 ícones Check
      expect(svgs.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ─── Edge Cases ───────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('não renderiza número do passo concluído (exibe check no lugar)', () => {
      render(<ProgressSteps passoAtual={3} />)
      // Passos 1 e 2 estão concluídos — não devem exibir números 1 e 2 como texto
      expect(screen.queryByText('1')).not.toBeInTheDocument()
      expect(screen.queryByText('2')).not.toBeInTheDocument()
    })
  })
})
