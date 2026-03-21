import { describe, it, expect } from 'vitest'
import {
  normalizarTelefone,
  formatarTelefone,
  validarTelefone,
} from '@/lib/utils/phone'

describe('lib/utils/phone', () => {
  // ─── normalizarTelefone ───────────────────────────────────────
  describe('normalizarTelefone', () => {
    it('converte celular (11 dígitos) para E.164', () => {
      expect(normalizarTelefone('11999999999')).toBe('+5511999999999')
    })

    it('converte fixo (10 dígitos) para E.164', () => {
      expect(normalizarTelefone('1133334444')).toBe('+551133334444')
    })

    it('remove formatação (11) 99999-9999 antes de converter', () => {
      expect(normalizarTelefone('(11) 99999-9999')).toBe('+5511999999999')
    })

    it('remove formatação (11) 3333-4444 antes de converter', () => {
      expect(normalizarTelefone('(11) 3333-4444')).toBe('+551133334444')
    })

    it('preserva número já em E.164 com DDI 55', () => {
      expect(normalizarTelefone('+5511999999999')).toBe('+5511999999999')
    })

    it('adiciona + quando já tem 55 no início (12+ dígitos)', () => {
      expect(normalizarTelefone('5511999999999')).toBe('+5511999999999')
    })

    it('trata número já com +55 (remove + antes)', () => {
      // +5511999999999 → strips + → 5511999999999 (13 dígitos, começa com 55) → +5511999999999
      const resultado = normalizarTelefone('+5511999999999')
      expect(resultado).toBe('+5511999999999')
    })
  })

  // ─── formatarTelefone ─────────────────────────────────────────
  describe('formatarTelefone', () => {
    it('formata celular (11 dígitos) como (XX) XXXXX-XXXX', () => {
      expect(formatarTelefone('11999999999')).toBe('(11) 99999-9999')
    })

    it('formata fixo (10 dígitos) como (XX) XXXX-XXXX', () => {
      expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
    })

    it('formata número com DDI 55 removendo DDI', () => {
      expect(formatarTelefone('+5511999999999')).toBe('(11) 99999-9999')
    })

    it('formata número com DDI sem +', () => {
      expect(formatarTelefone('5511999999999')).toBe('(11) 99999-9999')
    })

    it('retorna input inalterado quando não tem 10 ou 11 dígitos locais', () => {
      const invalido = '123'
      expect(formatarTelefone(invalido)).toBe(invalido)
    })
  })

  // ─── validarTelefone ──────────────────────────────────────────
  describe('validarTelefone', () => {
    it('retorna true para celular com 11 dígitos', () => {
      expect(validarTelefone('11999999999')).toBe(true)
    })

    it('retorna true para fixo com 10 dígitos', () => {
      expect(validarTelefone('1133334444')).toBe(true)
    })

    it('retorna true para número formatado (11) 99999-9999', () => {
      expect(validarTelefone('(11) 99999-9999')).toBe(true)
    })

    it('retorna true para número E.164 +5511999999999', () => {
      expect(validarTelefone('+5511999999999')).toBe(true)
    })

    it('retorna false para número curto demais', () => {
      expect(validarTelefone('9999999')).toBe(false)
    })

    it('retorna false para string vazia', () => {
      expect(validarTelefone('')).toBe(false)
    })

    it('retorna false para número com mais de 11 dígitos locais', () => {
      expect(validarTelefone('119999999999')).toBe(false) // 12 dígitos locais
    })
  })
})
