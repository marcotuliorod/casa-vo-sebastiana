import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingForm } from '@/components/booking/BookingForm'

// ─── Mocks ────────────────────────────────────────────────────────

// useFormState retorna [estado, action]
// Por padrão estado=null (sem erros)
let mockEstado: Record<string, unknown> | null = null

vi.mock('react-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-dom')>()
  return {
    ...original,
    useFormState: vi.fn((_action: unknown, initialState: unknown) => [
      mockEstado ?? initialState,
      vi.fn(),
    ]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

vi.mock('@/lib/actions/booking', () => ({
  criarAgendamento: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

// ─── Props padrão ─────────────────────────────────────────────────
const DEFAULT_PROPS = {
  data: '2025-07-15',
  horaInicio: '09:00',
  horaFim: '10:00',
}

beforeEach(() => {
  mockEstado = null
  vi.clearAllMocks()
})

describe('BookingForm', () => {
  // ─── Rendering ───────────────────────────────────────────────
  describe('Rendering', () => {
    it('renderiza sem erros', () => {
      const { container } = render(<BookingForm {...DEFAULT_PROPS} />)
      expect(container.querySelector('form')).toBeInTheDocument()
    })

    it('exibe campo Nome completo', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument()
    })

    it('exibe campo WhatsApp', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/whatsapp/i)).toBeInTheDocument()
    })

    it('exibe campo Email (opcional)', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })

    it('exibe campo Observações (opcional)', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/observações/i)).toBeInTheDocument()
    })

    it('exibe botão de confirmação', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByRole('button', { name: /confirmar agendamento/i })).toBeInTheDocument()
    })

    it('menciona confirmação via WhatsApp', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByText(/confirmação via whatsapp/i)).toBeInTheDocument()
    })
  })

  // ─── Resumo do slot ───────────────────────────────────────────
  describe('Resumo do horário escolhido', () => {
    it('exibe as horas de início e fim', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByText(/09:00/)).toBeInTheDocument()
      expect(screen.getByText(/10:00/)).toBeInTheDocument()
    })

    it('exibe a data formatada em português', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      // 2025-07-15 = terça-feira, 15 de julho de 2025
      expect(screen.getByText(/julho/i)).toBeInTheDocument()
    })

    it('campos ocultos contêm data e horários corretos', () => {
      const { container } = render(<BookingForm {...DEFAULT_PROPS} />)
      const dataHidden = container.querySelector('input[name="data"]') as HTMLInputElement
      const horaInicioHidden = container.querySelector('input[name="hora_inicio"]') as HTMLInputElement
      const horaFimHidden = container.querySelector('input[name="hora_fim"]') as HTMLInputElement
      expect(dataHidden.value).toBe('2025-07-15')
      expect(horaInicioHidden.value).toBe('09:00')
      expect(horaFimHidden.value).toBe('10:00')
    })
  })

  // ─── Campos de formulário ─────────────────────────────────────
  describe('Campos de formulário', () => {
    it('campo nome tem autocomplete="name"', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/nome completo/i)).toHaveAttribute('autocomplete', 'name')
    })

    it('campo telefone é type="tel"', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/whatsapp/i)).toHaveAttribute('type', 'tel')
    })

    it('campo telefone tem maxLength=15 (máscara formatada)', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/whatsapp/i)).toHaveAttribute('maxLength', '15')
    })

    it('campo email é type="email"', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email')
    })

    it('campo observações tem maxLength=500', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/observações/i)).toHaveAttribute('maxLength', '500')
    })

    it('nome e telefone são obrigatórios (required)', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/nome completo/i)).toBeRequired()
      expect(screen.getByLabelText(/whatsapp/i)).toBeRequired()
    })

    it('email e observações não são obrigatórios', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/email/i)).not.toBeRequired()
      expect(screen.getByLabelText(/observações/i)).not.toBeRequired()
    })
  })

  // ─── Máscara de telefone ──────────────────────────────────────
  describe('Máscara de telefone (onInput)', () => {
    it('formata número de celular enquanto o usuário digita', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      const input = screen.getByLabelText(/whatsapp/i) as HTMLInputElement

      // Simula digitar 11 dígitos
      fireEvent.input(input, { target: { value: '11999999999' } })
      expect(input.value).toBe('(11) 99999-9999')
    })

    it('formata parcialmente com 5 dígitos digitados', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      const input = screen.getByLabelText(/whatsapp/i) as HTMLInputElement

      fireEvent.input(input, { target: { value: '11999' } })
      expect(input.value).toBe('(11) 999')
    })
  })

  // ─── Estados de erro ─────────────────────────────────────────
  describe('Erros de validação', () => {
    it('exibe erro geral quando estado.erro está sem campo', () => {
      mockEstado = { erro: 'Horário não disponível', campo: null }
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByText('Horário não disponível')).toBeInTheDocument()
    })

    it('exibe link "Escolher outro horário" quando erro menciona horário', () => {
      mockEstado = { erro: 'Este horário não está mais disponível', campo: null }
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByRole('link', { name: /escolher outro horário/i })).toBeInTheDocument()
    })

    it('NÃO exibe link de voltar quando erro não menciona horário', () => {
      mockEstado = { erro: 'Erro interno do servidor', campo: null }
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.queryByRole('link', { name: /escolher outro horário/i })).not.toBeInTheDocument()
    })

    it('exibe erro de campo nome com borda vermelha', () => {
      mockEstado = { erro: 'Nome é obrigatório', campo: 'nome' }
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument()
      expect(screen.getByLabelText(/nome completo/i)).toHaveClass('border-brand-error')
    })

    it('exibe mensagem amigável para erro "Telefone inválido"', () => {
      mockEstado = { erro: 'Telefone inválido', campo: 'telefone' }
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByText(/celular válido com DDD/i)).toBeInTheDocument()
    })

    it('exibe erro de campo telefone com borda vermelha', () => {
      mockEstado = { erro: 'Telefone inválido', campo: 'telefone' }
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.getByLabelText(/whatsapp/i)).toHaveClass('border-brand-error')
    })

    it('sem estado de erro, não exibe mensagens de erro', () => {
      render(<BookingForm {...DEFAULT_PROPS} />)
      expect(screen.queryByText(/obrigatório/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/inválido/i)).not.toBeInTheDocument()
    })
  })
})
