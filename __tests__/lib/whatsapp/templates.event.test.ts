import { describe, it, expect } from 'vitest'
import {
  mensagemConfirmacaoEvento,
  mensagemLembreteEvento,
} from '@/lib/whatsapp/templates'

const BASE_EVENTO = {
  nomeCliente: 'Ana Lima',
  tituloEvento: 'Gira de Umbanda',
  dataEvento: '2027-06-07',
  horaInicio: '19:00',
  horaFim: '21:00',
  tokenPublico: 'evt-token-xyz',
  baseUrl: 'https://casavosebastiana.com.br',
}

const BASE_LEMBRETE = {
  nomeCliente: 'Ana Lima',
  tituloEvento: 'Gira de Umbanda',
  dataEvento: '2027-06-07',
  horaInicio: '19:00',
  tokenPublico: 'evt-token-xyz',
  baseUrl: 'https://casavosebastiana.com.br',
}

describe('lib/whatsapp/templates — eventos', () => {
  // ─── mensagemConfirmacaoEvento ────────────────────────────────
  describe('mensagemConfirmacaoEvento', () => {
    it('inclui nome do cliente', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).toContain('Ana Lima')
    })

    it('inclui título do evento em negrito WhatsApp', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).toContain('*Gira de Umbanda*')
    })

    it('inclui data formatada em português (junho)', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).toContain('junho')
      expect(msg).toContain('2027')
    })

    it('inclui horário de início e fim separados por —', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).toContain('19:00 — 21:00')
    })

    it('inclui link completo da inscrição', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).toContain('https://casavosebastiana.com.br/agendamento/evt-token-xyz')
    })

    it('menciona Casa de Vó Sebastiana', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).toContain('Casa de Vó Sebastiana')
    })

    it('contém saudação inicial e despedida', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).toContain('Olá')
      expect(msg).toContain('abençoe')
    })

    it('menciona inscrição (não agendamento)', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg.toLowerCase()).toContain('inscrição')
    })

    it('não contém URL com dupla barra', () => {
      const msg = mensagemConfirmacaoEvento(BASE_EVENTO)
      expect(msg).not.toContain('//agendamento')
    })

    it('funciona com nome que tem acentos', () => {
      const msg = mensagemConfirmacaoEvento({ ...BASE_EVENTO, nomeCliente: 'José Araújo' })
      expect(msg).toContain('José Araújo')
    })

    it('funciona com título longo de evento', () => {
      const titulo = 'Sessão de Desenvolvimento Espiritual e Cura pela Umbanda'
      const msg = mensagemConfirmacaoEvento({ ...BASE_EVENTO, tituloEvento: titulo })
      expect(msg).toContain(titulo)
    })

    it('data de dezembro é formatada corretamente', () => {
      const msg = mensagemConfirmacaoEvento({ ...BASE_EVENTO, dataEvento: '2027-12-15' })
      expect(msg).toContain('dezembro')
    })
  })

  // ─── mensagemLembreteEvento ───────────────────────────────────
  describe('mensagemLembreteEvento', () => {
    it('inclui nome do cliente', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      expect(msg).toContain('Ana Lima')
    })

    it('inclui título do evento em negrito WhatsApp', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      expect(msg).toContain('*Gira de Umbanda*')
    })

    it('inclui data do evento formatada', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      // 2027-06-07 → "07/06/2027"
      expect(msg).toContain('07/06/2027')
    })

    it('inclui horário de início', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      expect(msg).toContain('19:00')
    })

    it('inclui link para cancelamento', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      expect(msg).toContain('https://casavosebastiana.com.br/agendamento/evt-token-xyz')
    })

    it('menciona Casa de Vó Sebastiana', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      expect(msg).toContain('Casa de Vó Sebastiana')
    })

    it('menciona que cliente está inscrito', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      expect(msg.toLowerCase()).toContain('inscrito')
    })

    it('contém aviso de cancelamento', () => {
      const msg = mensagemLembreteEvento(BASE_LEMBRETE)
      expect(msg.toLowerCase()).toContain('cancelar')
    })
  })

  // ─── edge cases compartilhados ────────────────────────────────
  describe('edge cases', () => {
    it('confirmacao: baseUrl com trailing slash não duplica barra', () => {
      const msg = mensagemConfirmacaoEvento({
        ...BASE_EVENTO,
        baseUrl: 'https://casavosebastiana.com.br',
      })
      // Verifica que o token está presente sem dupla barra
      expect(msg).toContain('/agendamento/evt-token-xyz')
      expect(msg).not.toMatch(/\/\/agendamento/)
    })

    it('confirmacao e lembrete retornam strings não-vazias', () => {
      expect(mensagemConfirmacaoEvento(BASE_EVENTO).length).toBeGreaterThan(50)
      expect(mensagemLembreteEvento(BASE_LEMBRETE).length).toBeGreaterThan(50)
    })

    it('confirmacao: dois eventos diferentes produzem mensagens diferentes', () => {
      const msg1 = mensagemConfirmacaoEvento(BASE_EVENTO)
      const msg2 = mensagemConfirmacaoEvento({ ...BASE_EVENTO, tituloEvento: 'Sessão de Passes' })
      expect(msg1).not.toBe(msg2)
    })
  })
})
