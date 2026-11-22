import { describe, it, expect } from 'vitest'
import {
  eventoLogDoTipo,
  horaDeLembretesHorario,
  motivoDescarte,
  proximoRetry,
} from '@/lib/email/fila'

// 2026-11-22 15:00 UTC = 12:00 em Brasília
const AGORA = new Date('2026-11-22T15:00:00Z')
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000)

describe('motivoDescarte', () => {
  it('mantém item recente de agendamento futuro e confirmado', () => {
    expect(
      motivoDescarte(
        { tipo: 'confirmacao', criadoEm: horasAtras(1), agendamento: { status: 'confirmado', dataAgendada: '2026-11-23' } },
        AGORA
      )
    ).toBeNull()
  })

  it('descarta item com mais de 48h na fila', () => {
    expect(
      motivoDescarte({ tipo: 'confirmacao', criadoEm: horasAtras(49), agendamento: null }, AGORA)
    ).toMatch(/expirada/)
  })

  it('descarta confirmação de agendamento cancelado', () => {
    expect(
      motivoDescarte(
        { tipo: 'confirmacao', criadoEm: horasAtras(1), agendamento: { status: 'cancelado', dataAgendada: '2026-11-23' } },
        AGORA
      )
    ).toBe('agendamento cancelado')
  })

  it('não descarta aviso de cancelamento por o agendamento estar cancelado', () => {
    expect(
      motivoDescarte(
        { tipo: 'cancelamento', criadoEm: horasAtras(1), agendamento: { status: 'cancelado', dataAgendada: '2026-11-23' } },
        AGORA
      )
    ).toBeNull()
  })

  it('descarta item de agendamento que já passou (data de Brasília)', () => {
    expect(
      motivoDescarte(
        { tipo: 'confirmacao', criadoEm: horasAtras(2), agendamento: { status: 'confirmado', dataAgendada: '2026-11-21' } },
        AGORA
      )
    ).toBe('agendamento já passou')
  })

  it('mantém item de agendamento de hoje', () => {
    expect(
      motivoDescarte(
        { tipo: 'confirmacao', criadoEm: horasAtras(2), agendamento: { status: 'confirmado', dataAgendada: '2026-11-22' } },
        AGORA
      )
    ).toBeNull()
  })

  it('mantém item sem agendamento (mensagem ao admin) dentro da validade', () => {
    expect(motivoDescarte({ tipo: 'admin', criadoEm: horasAtras(3), agendamento: null }, AGORA)).toBeNull()
  })
})

describe('proximoRetry', () => {
  it('espaça as tentativas para cair nos ciclos horários seguintes', () => {
    const minutos = (n: number) => (proximoRetry(n, AGORA).getTime() - AGORA.getTime()) / 60_000
    expect(minutos(1)).toBe(55)
    expect(minutos(2)).toBe(115)
    expect(minutos(3)).toBe(235)
    expect(minutos(9)).toBe(235)
  })
})

describe('horaDeLembretesHorario', () => {
  it('libera a partir das 09:00 de Brasília', () => {
    expect(horaDeLembretesHorario(new Date('2026-11-22T11:59:00Z'))).toBe(false) // 08:59 BRT
    expect(horaDeLembretesHorario(new Date('2026-11-22T12:00:00Z'))).toBe(true) // 09:00 BRT
    expect(horaDeLembretesHorario(new Date('2026-11-23T02:30:00Z'))).toBe(true) // 23:30 BRT
    expect(horaDeLembretesHorario(new Date('2026-11-23T03:30:00Z'))).toBe(false) // 00:30 BRT
  })
})

describe('eventoLogDoTipo', () => {
  it('mapeia tipos da fila para eventos de log', () => {
    expect(eventoLogDoTipo('confirmacao')).toBe('confirmacao_agendamento')
    expect(eventoLogDoTipo('lembrete_24h')).toBe('lembrete_24h')
    expect(eventoLogDoTipo('cancelamento')).toBe('cancelamento')
    expect(eventoLogDoTipo('admin')).toBeNull()
  })
})
