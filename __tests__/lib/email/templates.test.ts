import { describe, it, expect } from 'vitest'
import {
  emailAgendamentoAlterado,
  emailAgendamentoConfirmado,
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

  it('pedido recebido: avisa que ainda falta a confirmação da Casa e mostra o horário completo', () => {
    const e = emailConfirmacao({ ...BASE, horaFim: '09:30' })
    expect(e.texto).toContain('precisa ser confirmado pela Casa')
    expect(e.texto).toContain('09:00 às 09:30')
  })

  it('confirmado: assunto, horário e link do agendamento', () => {
    const e = emailAgendamentoConfirmado({ ...BASE, horaFim: '09:30' })
    expect(e.assunto).toBe('Agendamento confirmado — Casa de Vó Sebastiana')
    expect(e.texto).toContain('Seu atendimento na Casa de Vó Sebastiana está confirmado.')
    expect(e.texto).toContain('09:00 às 09:30')
    expect(e.texto).toContain('https://agenda.exemplo.com/agendamento/tok-1')
  })

  it('confirmado (evento): título no assunto e nos detalhes', () => {
    const e = emailAgendamentoConfirmado({ ...BASE, tituloEvento: 'Gira' })
    expect(e.assunto).toBe('Inscrição confirmada: Gira — Casa de Vó Sebastiana')
    expect(e.texto).toContain('Evento: Gira')
  })

  it('alterado: mostra data anterior e nova', () => {
    const e = emailAgendamentoAlterado({
      ...BASE,
      dataAgendada: '2025-07-22',
      horaFim: '09:30',
      dataAnterior: '2025-07-15',
      horaAnterior: '10:00',
    })
    expect(e.texto).toContain('terça-feira, 15 de julho às 10:00')
    expect(e.texto).toContain('Nova data: terça-feira, 22 de julho de 2025')
    expect(e.texto).toContain('Novo horário: 09:00 às 09:30')
  })

  it('cancelamento: inclui o motivo quando informado, escapado no HTML', () => {
    expect(emailCancelamento({ ...BASE, motivo: 'Casa <fechada>' }).texto).toContain('Motivo: Casa <fechada>')
    expect(emailCancelamento({ ...BASE, motivo: 'Casa <fechada>' }).html).toContain('Motivo: Casa &lt;fechada&gt;')
    expect(emailCancelamento(BASE).texto).not.toContain('Motivo')
  })

  describe('informações da Casa nos e-mails', () => {
    const casa = {
      endereco: 'Rua das Flores, 10',
      linkMapa: 'https://maps.app.goo.gl/abc',
      emailContato: 'casa@exemplo.com',
      telefoneContato: null,
      orientacoes: 'Chegue 15 minutos antes.\nUse roupa clara.',
      politicaCancelamento: 'Cancele pelo link.',
      responsavelDados: null,
    }

    it('pedido recebido: endereço, mapa clicável, contato e orientações', () => {
      const e = emailConfirmacao({ ...BASE, casa })
      expect(e.texto).toContain('Endereço: Rua das Flores, 10')
      expect(e.texto).toContain('Mapa: https://maps.app.goo.gl/abc')
      expect(e.texto).toContain('Contato: casa@exemplo.com')
      expect(e.texto).toContain('Chegue 15 minutos antes.\nUse roupa clara.')
      expect(e.html).toContain('<a href="https://maps.app.goo.gl/abc"')
      expect(e.html).toContain('Abrir no mapa')
      expect(e.texto).not.toContain('Cancele pelo link.')
    })

    it('confirmado: inclui também a política de cancelamento', () => {
      expect(emailAgendamentoConfirmado({ ...BASE, casa }).texto).toContain('Cancele pelo link.')
    })

    it('alteração e eventos: endereço sem as orientações do atendimento', () => {
      const alt = emailAgendamentoAlterado({ ...BASE, dataAnterior: '2025-07-01', horaAnterior: '10:00', casa })
      expect(alt.texto).toContain('Endereço: Rua das Flores, 10')
      expect(alt.texto).not.toContain('Chegue 15 minutos')
      const ev = emailLembreteEvento({ nomeCliente: 'Maria', tituloEvento: 'Gira', dataEvento: '2025-07-15', horaInicio: '19:00', tokenPublico: 't', baseUrl: 'https://x', casa })
      expect(ev.texto).toContain('Endereço: Rua das Flores, 10')
      expect(ev.texto).not.toContain('Chegue 15 minutos')
    })

    it('sem informações da Casa, nada muda', () => {
      expect(emailConfirmacao(BASE).texto).not.toContain('Endereço')
    })
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
    expect(emailConfirmacaoEvento(info).texto).toContain('19:00 às 21:00')
    expect(emailConfirmacaoEvento(info).texto).toContain('precisa ser confirmada pela Casa')
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
