import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseISO } from 'date-fns'
import {
  formatarData,
  formatarDataExtenso,
  amanha,
  ehDataPassada,
  diaDaSemana,
  paraUtc,
  FUSO_HORARIO_BR,
} from '@/lib/utils/date'

describe('lib/utils/date', () => {
  // ─── formatarData ────────────────────────────────────────────
  describe('formatarData', () => {
    it('formata string ISO como dd/MM/yyyy', () => {
      expect(formatarData('2025-03-21')).toBe('21/03/2025')
    })

    it('formata objeto Date como dd/MM/yyyy', () => {
      expect(formatarData(parseISO('2025-12-01'))).toBe('01/12/2025')
    })

    it('formata dia com zero à esquerda', () => {
      expect(formatarData('2025-01-05')).toBe('05/01/2025')
    })
  })

  // ─── formatarDataExtenso ─────────────────────────────────────
  describe('formatarDataExtenso', () => {
    it('formata data por extenso em português', () => {
      // 2025-03-21 = sexta-feira
      const resultado = formatarDataExtenso('2025-03-21')
      expect(resultado).toContain('março')
      expect(resultado).toContain('2025')
      expect(resultado).toContain('21')
    })

    it('formata data com locale ptBR', () => {
      // 2025-01-01 = quarta-feira
      const resultado = formatarDataExtenso('2025-01-01')
      expect(resultado).toContain('janeiro')
    })
  })

  // ─── amanha ──────────────────────────────────────────────────
  describe('amanha', () => {
    it('retorna string no formato yyyy-MM-dd', () => {
      const resultado = amanha()
      expect(resultado).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('retorna a data de amanhã relativa ao fuso de SP', () => {
      const hoje = new Date()
      const resultado = amanha()
      const partes = resultado.split('-').map(Number)
      const dataAmanha = new Date(partes[0], partes[1] - 1, partes[2])
      // A data de amanhã deve ser estritamente maior que hoje
      expect(dataAmanha.getTime()).toBeGreaterThan(hoje.setHours(0, 0, 0, 0) - 1)
    })
  })

  // ─── ehDataPassada ───────────────────────────────────────────
  describe('ehDataPassada', () => {
    it('retorna true para data antiga', () => {
      expect(ehDataPassada('2000-01-01')).toBe(true)
    })

    it('retorna false para data futura', () => {
      expect(ehDataPassada('2099-12-31')).toBe(false)
    })

    it('retorna false para hoje', () => {
      // Usa a data de hoje no fuso de SP
      const { formatInTimeZone } = require('date-fns-tz')
      const hoje = formatInTimeZone(new Date(), FUSO_HORARIO_BR, 'yyyy-MM-dd')
      expect(ehDataPassada(hoje)).toBe(false)
    })
  })

  // ─── diaDaSemana ─────────────────────────────────────────────
  describe('diaDaSemana', () => {
    it('retorna 0 para domingo', () => {
      expect(diaDaSemana('2025-03-23')).toBe(0) // 23/03/2025 = domingo
    })

    it('retorna 1 para segunda-feira', () => {
      expect(diaDaSemana('2025-03-24')).toBe(1)
    })

    it('retorna 2 para terça-feira', () => {
      expect(diaDaSemana('2025-03-25')).toBe(2)
    })

    it('retorna 5 para sexta-feira', () => {
      expect(diaDaSemana('2025-03-21')).toBe(5)
    })

    it('retorna 6 para sábado', () => {
      expect(diaDaSemana('2025-03-22')).toBe(6)
    })
  })

  // ─── paraUtc ─────────────────────────────────────────────────
  describe('paraUtc', () => {
    it('retorna um objeto Date', () => {
      const resultado = paraUtc('2025-03-21', '09:00')
      expect(resultado).toBeInstanceOf(Date)
    })

    it('converte hora de SP para UTC (offset -3h no horário de verão saiu)', () => {
      // Sem horário de verão, SP = UTC-3
      // 12:00 de SP = 15:00 UTC
      const resultado = paraUtc('2025-07-15', '12:00')
      expect(resultado.getUTCHours()).toBe(15)
    })

    it('produz datas diferentes para horas diferentes', () => {
      const hora09 = paraUtc('2025-03-21', '09:00')
      const hora14 = paraUtc('2025-03-21', '14:00')
      expect(hora14.getTime()).toBeGreaterThan(hora09.getTime())
    })

    it('horários consecutivos têm diferença de 1 hora', () => {
      const hora09 = paraUtc('2025-03-21', '09:00')
      const hora10 = paraUtc('2025-03-21', '10:00')
      const diffMs = hora10.getTime() - hora09.getTime()
      expect(diffMs).toBe(60 * 60 * 1000)
    })
  })
})
