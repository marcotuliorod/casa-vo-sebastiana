import { describe, it, expect } from 'vitest'
import {
  emailAtribuicaoMedium,
  emailCancelamento,
  emailCancelamentoAdmin,
  emailConfirmacao,
  emailConfirmacaoEvento,
  emailLembrete24h,
  emailLembreteEvento,
  emailNovoAgendamentoAdmin,
} from '@/lib/email/templates'

const BASE = { nomeCliente: 'Maria', dataAgendada: '2025-07-15', horaInicio: '09:00', tokenPublico: 'tok-1', baseUrl: 'https://agenda.exemplo.com' }

describe('templates de e-mail', () => {
  it('confirmação: data por extenso, horário e link do agendamento', () => {
    const e = emailConfirmacao(BASE)
    expect(e.assunto).toMatch(/Agendamento recebido/)
    expect(e.texto).toContain('terça-feira, 15 de julho de 2025')
    expect(e.texto).toContain('09:00')
    expect(e.texto).toContain('https://agenda.exemplo.com/agendamento/tok-1')
    expect(e.html).toContain('href="https://agenda.exemplo.com/agendamento/tok-1"')
  })

  it('lembrete: menciona amanhã e o link para cancelar', () => {
    const e = emailLembrete24h(BASE)
    expect(e.assunto).toMatch(/amanhã/)
    expect(e.texto).toContain('/agendamento/tok-1')
  })

  it('cancelamento: aponta para novo agendamento', () => {
    const e = emailCancelamento(BASE)
    expect(e.assunto).toMatch(/cancelado/)
    expect(e.texto).toContain('https://agenda.exemplo.com/agendar')
  })

  it('evento: título no assunto e intervalo de horário', () => {
    const info = { nomeCliente: 'Maria', tituloEvento: 'Gira', dataEvento: '2025-07-15', horaInicio: '19:00', horaFim: '21:00', tokenPublico: 'tok-1', baseUrl: 'https://x' }
    expect(emailConfirmacaoEvento(info).assunto).toContain('Gira')
    expect(emailConfirmacaoEvento(info).texto).toContain('19:00 — 21:00')
    expect(emailLembreteEvento(info).assunto).toContain('Gira')
  })

  it('aviso à Casa: dados de contato do consulente e evento quando houver', () => {
    const info = { nomeCliente: 'Maria', telefoneCliente: '+5511999999999', emailCliente: 'maria@x.com', dataAgendada: '2025-07-15', horaInicio: '09:00', horaFim: '10:00' }
    const novo = emailNovoAgendamentoAdmin(info)
    expect(novo.assunto).toBe('Novo agendamento: Maria em 15/07')
    expect(novo.texto).toContain('Telefone: +5511999999999')
    expect(novo.texto).toContain('E-mail: maria@x.com')
    expect(emailNovoAgendamentoAdmin({ ...info, tituloEvento: 'Gira' }).texto).toContain('Evento: Gira')
    expect(emailCancelamentoAdmin(info).assunto).toBe('Cancelamento: Maria em 15/07')
  })

  it('médium: nome do consulente e horário', () => {
    const e = emailAtribuicaoMedium({ nomeMedium: 'João', nomeCliente: 'Ana', dataAgendada: '2025-07-15', horaInicio: '09:00', horaFim: '10:00' })
    expect(e.texto).toContain('Olá, João!')
    expect(e.texto).toContain('Consulente: Ana')
  })

  it('escapa dados do usuário no HTML (sem injeção de tags)', () => {
    const e = emailConfirmacao({ ...BASE, nomeCliente: '<script>alert(1)</script> & "x"' })
    expect(e.html).not.toContain('<script>')
    expect(e.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;')
    // O texto puro mantém o nome como digitado
    expect(e.texto).toContain('<script>alert(1)</script>')
  })
})
