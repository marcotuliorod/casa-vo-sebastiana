import { describe, it, expect } from 'vitest'
import {
  mensagemConfirmacao,
  mensagemLembrete24h,
  mensagemNovoAgendamentoAdmin,
  mensagemCancelamentoAdmin,
  mensagemAtribuicaoMedium,
  mensagemCancelamento,
} from '@/lib/whatsapp/templates'

const BASE_INFO = {
  nomeCliente: 'Marco Tulio',
  dataAgendada: '2025-07-15',
  horaInicio: '09:00',
  tokenPublico: 'abc123token',
  baseUrl: 'https://casavosebastiana.com.br',
}

const BASE_ADMIN = {
  nomeCliente: 'Marco Tulio',
  telefoneCliente: '+5511999999999',
  dataAgendada: '2025-07-15',
  horaInicio: '09:00',
  horaFim: '10:00',
}

describe('lib/whatsapp/templates', () => {
  // ─── mensagemConfirmacao ──────────────────────────────────────
  describe('mensagemConfirmacao', () => {
    it('inclui nome do cliente', () => {
      const msg = mensagemConfirmacao(BASE_INFO)
      expect(msg).toContain('Marco Tulio')
    })

    it('inclui a hora de início', () => {
      const msg = mensagemConfirmacao(BASE_INFO)
      expect(msg).toContain('09:00')
    })

    it('inclui o link completo do agendamento', () => {
      const msg = mensagemConfirmacao(BASE_INFO)
      expect(msg).toContain('https://casavosebastiana.com.br/agendamento/abc123token')
    })

    it('inclui data formatada em português (julho)', () => {
      const msg = mensagemConfirmacao(BASE_INFO)
      expect(msg).toContain('julho')
    })

    it('contém saudação e despedida', () => {
      const msg = mensagemConfirmacao(BASE_INFO)
      expect(msg).toContain('Olá')
      expect(msg).toContain('abençoe')
    })

    it('menciona Casa de Vó Sebastiana', () => {
      const msg = mensagemConfirmacao(BASE_INFO)
      expect(msg).toContain('Casa de Vó Sebastiana')
    })
  })

  // ─── mensagemLembrete24h ──────────────────────────────────────
  describe('mensagemLembrete24h', () => {
    it('inclui nome do cliente', () => {
      const msg = mensagemLembrete24h(BASE_INFO)
      expect(msg).toContain('Marco Tulio')
    })

    it('inclui a hora de início', () => {
      const msg = mensagemLembrete24h(BASE_INFO)
      expect(msg).toContain('09:00')
    })

    it('menciona "amanhã"', () => {
      const msg = mensagemLembrete24h(BASE_INFO)
      expect(msg.toLowerCase()).toContain('amanhã')
    })

    it('inclui link para cancelamento', () => {
      const msg = mensagemLembrete24h(BASE_INFO)
      expect(msg).toContain('https://casavosebastiana.com.br/agendamento/abc123token')
    })
  })

  // ─── mensagemNovoAgendamentoAdmin ─────────────────────────────
  describe('mensagemNovoAgendamentoAdmin', () => {
    it('indica novo agendamento', () => {
      const msg = mensagemNovoAgendamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('Novo agendamento')
    })

    it('inclui nome do cliente', () => {
      const msg = mensagemNovoAgendamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('Marco Tulio')
    })

    it('inclui telefone do cliente', () => {
      const msg = mensagemNovoAgendamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('+5511999999999')
    })

    it('inclui hora de início e fim separadas por —', () => {
      const msg = mensagemNovoAgendamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('09:00 — 10:00')
    })

    it('inclui data formatada em português', () => {
      const msg = mensagemNovoAgendamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('julho')
    })
  })

  // ─── mensagemCancelamentoAdmin ────────────────────────────────
  describe('mensagemCancelamentoAdmin', () => {
    it('indica cancelamento', () => {
      const msg = mensagemCancelamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('Cancelamento')
    })

    it('inclui nome e telefone do cliente', () => {
      const msg = mensagemCancelamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('Marco Tulio')
      expect(msg).toContain('+5511999999999')
    })

    it('inclui hora de início e fim', () => {
      const msg = mensagemCancelamentoAdmin(BASE_ADMIN)
      expect(msg).toContain('09:00 — 10:00')
    })
  })

  // ─── mensagemAtribuicaoMedium ─────────────────────────────────
  describe('mensagemAtribuicaoMedium', () => {
    const infoMedium = {
      nomeMedium: 'Luciene Oliveira',
      nomeCliente: 'Marco Tulio',
      dataAgendada: '2025-07-15',
      horaInicio: '09:00',
      horaFim: '10:00',
    }

    it('inclui nome do médium', () => {
      const msg = mensagemAtribuicaoMedium(infoMedium)
      expect(msg).toContain('Luciene Oliveira')
    })

    it('inclui nome do cliente', () => {
      const msg = mensagemAtribuicaoMedium(infoMedium)
      expect(msg).toContain('Marco Tulio')
    })

    it('inclui horário do atendimento', () => {
      const msg = mensagemAtribuicaoMedium(infoMedium)
      expect(msg).toContain('09:00 — 10:00')
    })

    it('menciona novo atendimento', () => {
      const msg = mensagemAtribuicaoMedium(infoMedium)
      expect(msg).toContain('novo atendimento')
    })
  })

  // ─── mensagemCancelamento ─────────────────────────────────────
  describe('mensagemCancelamento', () => {
    it('inclui nome do cliente', () => {
      const msg = mensagemCancelamento(BASE_INFO)
      expect(msg).toContain('Marco Tulio')
    })

    it('confirma o cancelamento', () => {
      const msg = mensagemCancelamento(BASE_INFO)
      expect(msg).toContain('cancelado')
    })

    it('inclui link para reagendar', () => {
      const msg = mensagemCancelamento(BASE_INFO)
      expect(msg).toContain('https://casavosebastiana.com.br/agendar')
    })

    it('menciona Casa de Vó Sebastiana', () => {
      const msg = mensagemCancelamento(BASE_INFO)
      expect(msg).toContain('Casa de Vó Sebastiana')
    })
  })

  // ─── edge cases ──────────────────────────────────────────────
  describe('edge cases', () => {
    it('confirmacao: nome com acentos funciona', () => {
      const msg = mensagemConfirmacao({ ...BASE_INFO, nomeCliente: 'João São' })
      expect(msg).toContain('João São')
    })

    it('confirmacao: baseUrl sem trailing slash constrói URL correta', () => {
      const msg = mensagemConfirmacao({ ...BASE_INFO, baseUrl: 'https://example.com' })
      expect(msg).toContain('https://example.com/agendamento/abc123token')
      expect(msg).not.toContain('//agendamento')
    })

    it('admin: data de janeiro formatada em português', () => {
      const msg = mensagemNovoAgendamentoAdmin({ ...BASE_ADMIN, dataAgendada: '2025-01-10' })
      expect(msg).toContain('janeiro')
    })
  })
})
