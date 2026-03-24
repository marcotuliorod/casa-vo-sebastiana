'use client'

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppointmentTable } from '@/components/admin/AppointmentTable'
import type { AgendamentoComCliente, Medium } from '@/types/database'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/actions/admin', () => ({
  atualizarStatusAgendamento: vi.fn().mockResolvedValue(undefined),
  atribuirMedium: vi.fn().mockResolvedValue(undefined),
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeMedium = (overrides: Partial<Medium> = {}): Medium => ({
  id: 'medium-1',
  nome: 'Mãe Joana',
  especialidade: 'Umbanda',
  telefone: '11988881234',
  token_acesso: 'token-abc',
  ativo: true,
  criado_em: '2025-01-01T00:00:00Z',
  ...overrides,
})

const makeAgendamento = (
  overrides: Partial<AgendamentoComCliente> = {}
): AgendamentoComCliente => ({
  id: 'ag-1',
  cliente_id: 'cli-1',
  data_agendada: '2027-07-10',
  hora_inicio: '09:00',
  hora_fim: '10:00',
  status: 'pendente',
  medium_id: null,
  evento_id: null,
  token_publico: 'tok-123',
  lembrete_enviado: false,
  notas: null,
  criado_em: '2025-01-01T00:00:00Z',
  atualizado_em: '2025-01-01T00:00:00Z',
  clientes: {
    id: 'cli-1',
    nome: 'Marco Tulio',
    telefone: '11999998888',
    email: null,
    notas: null,
    criado_em: '2025-01-01T00:00:00Z',
    atualizado_em: '2025-01-01T00:00:00Z',
  },
  ...overrides,
})

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AppointmentTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Estado vazio ───────────────────────────────────────────
  describe('Estado vazio', () => {
    it('renderiza mensagem de estado vazio quando lista está vazia', () => {
      render(<AppointmentTable agendamentos={[]} />)
      expect(screen.getByText('Nenhum agendamento encontrado.')).toBeInTheDocument()
    })

    it('NÃO renderiza a tabela quando lista está vazia', () => {
      render(<AppointmentTable agendamentos={[]} />)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  // ─── Renderização da tabela ─────────────────────────────────
  describe('Renderização da tabela', () => {
    it('renderiza cabeçalhos das colunas', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      expect(screen.getByText('Consulente')).toBeInTheDocument()
      expect(screen.getByText('Data & Horário')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Médium')).toBeInTheDocument()
      expect(screen.getByText('WhatsApp')).toBeInTheDocument()
      expect(screen.getByText('Ações')).toBeInTheDocument()
    })

    it('exibe nome do consulente', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      expect(screen.getByText('Marco Tulio')).toBeInTheDocument()
    })

    it('exibe telefone formatado do consulente', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      // formatarTelefone('11999998888') = '(11) 99999-8888'
      expect(screen.getByText('(11) 99999-8888')).toBeInTheDocument()
    })

    it('exibe data formatada no padrão brasileiro', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      // formatarData('2027-07-10') = '10/07/2027'
      expect(screen.getByText('10/07/2027')).toBeInTheDocument()
    })

    it('exibe horário de início e fim', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      expect(screen.getByText('09:00 — 10:00')).toBeInTheDocument()
    })

    it('exibe link de WhatsApp com href correto', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      const link = screen.getByText('Abrir chat ↗')
      expect(link.closest('a')).toHaveAttribute('href', 'https://wa.me/11999998888')
    })

    it('link de WhatsApp abre em nova aba', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      const link = screen.getByText('Abrir chat ↗')
      expect(link.closest('a')).toHaveAttribute('target', '_blank')
    })

    it('exibe botão "Exportar CSV"', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} />)
      expect(screen.getByText('Exportar CSV')).toBeInTheDocument()
    })

    it('renderiza múltiplos agendamentos', () => {
      const ag1 = makeAgendamento({ id: 'ag-1', clientes: { ...makeAgendamento().clientes, nome: 'Maria' } })
      const ag2 = makeAgendamento({ id: 'ag-2', clientes: { ...makeAgendamento().clientes, nome: 'João' } })
      render(<AppointmentTable agendamentos={[ag1, ag2]} />)
      expect(screen.getByText('Maria')).toBeInTheDocument()
      expect(screen.getByText('João')).toBeInTheDocument()
    })
  })

  // ─── Ações por status ────────────────────────────────────────
  describe('Botões de ação — status pendente', () => {
    it('exibe botão "Confirmar" para agendamento pendente', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'pendente' })]} />)
      expect(screen.getByText('Confirmar')).toBeInTheDocument()
    })

    it('exibe botão "Cancelar" para agendamento pendente', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'pendente' })]} />)
      expect(screen.getByText('Cancelar')).toBeInTheDocument()
    })

    it('NÃO exibe botão "Realizado" para pendente', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'pendente' })]} />)
      expect(screen.queryByText('Realizado')).not.toBeInTheDocument()
    })
  })

  describe('Botões de ação — status confirmado', () => {
    it('exibe botão "Realizado" para agendamento confirmado', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'confirmado' })]} />)
      expect(screen.getByText('Realizado')).toBeInTheDocument()
    })

    it('exibe botão "Cancelar" para agendamento confirmado', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'confirmado' })]} />)
      expect(screen.getByText('Cancelar')).toBeInTheDocument()
    })

    it('NÃO exibe botão "Confirmar" para confirmado', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'confirmado' })]} />)
      expect(screen.queryByText('Confirmar')).not.toBeInTheDocument()
    })
  })

  describe('Botões de ação — status finalizado', () => {
    it('NÃO exibe botões de ação para status "realizado"', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'realizado' })]} />)
      expect(screen.queryByText('Confirmar')).not.toBeInTheDocument()
      expect(screen.queryByText('Cancelar')).not.toBeInTheDocument()
      // "Realizado" aparece no StatusBadge (span), mas NÃO deve existir como botão
      const botoesRealizado = screen.queryAllByRole('button', { name: /realizado/i })
      expect(botoesRealizado).toHaveLength(0)
    })

    it('NÃO exibe botões de ação para status "cancelado"', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'cancelado' })]} />)
      expect(screen.queryByText('Confirmar')).not.toBeInTheDocument()
      expect(screen.queryByText('Cancelar')).not.toBeInTheDocument()
    })

    it('NÃO exibe botões de ação para status "nao_compareceu"', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'nao_compareceu' })]} />)
      expect(screen.queryByText('Confirmar')).not.toBeInTheDocument()
      expect(screen.queryByText('Cancelar')).not.toBeInTheDocument()
    })
  })

  // ─── Confirmação de cancelamento (2 etapas) ─────────────────
  describe('Fluxo de cancelamento em 2 etapas', () => {
    it('exibe "Confirmar?" ao clicar em Cancelar pela primeira vez', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'pendente' })]} />)
      fireEvent.click(screen.getByText('Cancelar'))
      expect(screen.getByText('Confirmar?')).toBeInTheDocument()
    })

    it('exibe botões "Sim" e "Não" após clicar em Cancelar', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'pendente' })]} />)
      fireEvent.click(screen.getByText('Cancelar'))
      expect(screen.getByText('Sim')).toBeInTheDocument()
      expect(screen.getByText('Não')).toBeInTheDocument()
    })

    it('clicar em "Não" volta ao estado normal sem cancelar', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento({ status: 'pendente' })]} />)
      fireEvent.click(screen.getByText('Cancelar'))
      fireEvent.click(screen.getByText('Não'))
      // Deve voltar ao botão Cancelar original
      expect(screen.getByText('Cancelar')).toBeInTheDocument()
      expect(screen.queryByText('Confirmar?')).not.toBeInTheDocument()
    })

    it('clicar em "Sim" chama atualizarStatusAgendamento com status "cancelado"', async () => {
      const { atualizarStatusAgendamento } = await import('@/lib/actions/admin')
      render(<AppointmentTable agendamentos={[makeAgendamento({ id: 'ag-42', status: 'pendente' })]} />)
      fireEvent.click(screen.getByText('Cancelar'))
      fireEvent.click(screen.getByText('Sim'))
      // useTransition executa assincronamente; verificamos que foi chamado
      expect(atualizarStatusAgendamento).toHaveBeenCalledWith('ag-42', 'cancelado')
    })
  })

  // ─── Select de médium ────────────────────────────────────────
  describe('MediumSelect', () => {
    it('exibe "— sem médium" como opção padrão', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} mediuns={[makeMedium()]} />)
      expect(screen.getByRole('option', { name: '— sem médium' })).toBeInTheDocument()
    })

    it('exibe médium ativo na lista', () => {
      render(<AppointmentTable agendamentos={[makeAgendamento()]} mediuns={[makeMedium()]} />)
      expect(screen.getByRole('option', { name: 'Mãe Joana' })).toBeInTheDocument()
    })

    it('NÃO exibe médium inativo', () => {
      render(
        <AppointmentTable
          agendamentos={[makeAgendamento()]}
          mediuns={[makeMedium({ ativo: false, nome: 'Padre José' })]}
        />
      )
      expect(screen.queryByRole('option', { name: 'Padre José' })).not.toBeInTheDocument()
    })

    it('seleciona médium atribuído ao agendamento', () => {
      render(
        <AppointmentTable
          agendamentos={[makeAgendamento({ medium_id: 'medium-1' })]}
          mediuns={[makeMedium()]}
        />
      )
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('medium-1')
    })

    it('valor do select é vazio quando sem médium atribuído', () => {
      render(
        <AppointmentTable
          agendamentos={[makeAgendamento({ medium_id: null })]}
          mediuns={[makeMedium()]}
        />
      )
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('')
    })
  })
})
