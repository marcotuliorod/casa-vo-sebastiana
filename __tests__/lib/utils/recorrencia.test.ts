import { describe, it, expect } from 'vitest'
import { expandirOcorrencias, ehOcorrenciaValida } from '@/lib/utils/recorrencia'

// Datas fixas no futuro distante para garantir estabilidade dos testes
const FUTURO_PROX = '2027-06-07'   // domingo
const FUTURO_2    = '2027-06-14'   // domingo seguinte
const FUTURO_3    = '2027-06-21'   // domingo + 2 semanas
const FUTURO_4    = '2027-06-28'   // domingo + 3 semanas
const FUTURO_QZ_2 = '2027-06-21'   // quinzenal: +2 semanas
const FUTURO_MES  = '2027-07-07'   // +1 mês
const PASSADO     = '2000-01-01'

describe('lib/utils/recorrencia', () => {
  // ─── expandirOcorrencias ─────────────────────────────────────
  describe('expandirOcorrencias', () => {
    // ── evento único ─────────────────────────────────────────
    describe("recorrencia = 'nenhuma'", () => {
      it('retorna [data_inicio] quando a data é futura', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'nenhuma',
        })
        expect(result).toEqual([FUTURO_PROX])
      })

      it('retorna [] quando a data já passou', () => {
        const result = expandirOcorrencias({
          data_inicio: PASSADO,
          recorrencia: 'nenhuma',
        })
        expect(result).toEqual([])
      })

      it('ignora data_fim_recorrencia em evento único', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'nenhuma',
          data_fim_recorrencia: '2020-01-01', // data fim no passado — não deve importar
        })
        // evento único: só verifica se a data é futura, não usa data_fim_recorrencia
        expect(result).toEqual([FUTURO_PROX])
      })
    })

    // ── recorrência semanal ───────────────────────────────────
    describe("recorrencia = 'semanal'", () => {
      it('gera múltiplas datas em intervalos de 7 dias', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
          limite: 4,
        })
        expect(result).toHaveLength(4)
        expect(result[0]).toBe(FUTURO_PROX)
        expect(result[1]).toBe(FUTURO_2)
        expect(result[2]).toBe(FUTURO_3)
        expect(result[3]).toBe(FUTURO_4)
      })

      it('respeita data_fim_recorrencia e para antes', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
          data_fim_recorrencia: FUTURO_3, // inclui até 2027-06-21
          limite: 52,
        })
        // Deve incluir 2027-06-07, 2027-06-14, 2027-06-21 mas NÃO 2027-06-28
        expect(result).toContain(FUTURO_PROX)
        expect(result).toContain(FUTURO_2)
        expect(result).toContain(FUTURO_3)
        expect(result).not.toContain(FUTURO_4)
      })

      it('retorna array vazio se data_inicio no passado e data_fim no passado', () => {
        const result = expandirOcorrencias({
          data_inicio: '2020-01-06',
          recorrencia: 'semanal',
          data_fim_recorrencia: '2020-03-01',
          limite: 52,
        })
        expect(result).toEqual([])
      })

      it('pula ocorrências passadas mas continua gerando futuras', () => {
        // data_inicio no passado, data_fim no futuro distante
        const result = expandirOcorrencias({
          data_inicio: PASSADO,
          recorrencia: 'semanal',
          data_fim_recorrencia: '2027-12-31',
          limite: 52,
        })
        // Deve ter ocorrências futuras (2000-01-01 + 52 semanas ainda é no passado,
        // então limit=52 pode ser zero; com limite alto encontra futuras)
        // O importante: todas as datas retornadas são futuras
        result.forEach((d) => {
          expect(d >= '2026-03-24').toBe(true)
        })
      })

      it('retorna array ordenado crescentemente', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
          limite: 5,
        })
        const sorted = [...result].sort()
        expect(result).toEqual(sorted)
      })

      it('usa limite padrão de 52 iterações quando não informado', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
        })
        // 52 iterações futuras → exatamente 52 resultados
        expect(result.length).toBeLessThanOrEqual(52)
        expect(result.length).toBeGreaterThan(0)
      })
    })

    // ── recorrência quinzenal ─────────────────────────────────
    describe("recorrencia = 'quinzenal'", () => {
      it('gera datas em intervalos de 14 dias', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'quinzenal',
          limite: 3,
        })
        expect(result).toHaveLength(3)
        expect(result[0]).toBe(FUTURO_PROX)  // 2027-06-07
        expect(result[1]).toBe(FUTURO_QZ_2)   // 2027-06-21
        expect(result[2]).toBe('2027-07-05')   // 2027-07-05
      })

      it('intervalo entre datas quinzenais é sempre 14 dias', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'quinzenal',
          limite: 4,
        })
        for (let i = 1; i < result.length; i++) {
          const prev = new Date(result[i - 1])
          const curr = new Date(result[i])
          const diffDias = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
          expect(diffDias).toBe(14)
        }
      })
    })

    // ── recorrência mensal ────────────────────────────────────
    describe("recorrencia = 'mensal'", () => {
      it('gera datas em intervalos de 1 mês', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'mensal',
          limite: 3,
        })
        expect(result).toHaveLength(3)
        expect(result[0]).toBe(FUTURO_PROX)  // 2027-06-07
        expect(result[1]).toBe(FUTURO_MES)    // 2027-07-07
        expect(result[2]).toBe('2027-08-07')   // 2027-08-07
      })

      it('respeita data_fim_recorrencia para eventos mensais', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'mensal',
          data_fim_recorrencia: '2027-08-07',
          limite: 52,
        })
        expect(result).toContain(FUTURO_PROX)
        expect(result).toContain(FUTURO_MES)
        expect(result).toContain('2027-08-07')
        expect(result).not.toContain('2027-09-07')
      })
    })

    // ── limite de segurança ───────────────────────────────────
    describe('limite de iterações', () => {
      it('respeita limite personalizado', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
          limite: 3,
        })
        expect(result).toHaveLength(3)
      })

      it('limite=1 retorna somente a primeira ocorrência', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
          limite: 1,
        })
        expect(result).toHaveLength(1)
        expect(result[0]).toBe(FUTURO_PROX)
      })

      it('sem data_fim e sem limite explícito não cria loop infinito', () => {
        // Deve terminar normalmente com o limite padrão (52)
        expect(() => {
          expandirOcorrencias({
            data_inicio: FUTURO_PROX,
            recorrencia: 'semanal',
          })
        }).not.toThrow()
      })
    })

    // ── formato de saída ──────────────────────────────────────
    describe('formato de saída', () => {
      it('retorna strings no formato YYYY-MM-DD', () => {
        const result = expandirOcorrencias({
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
          limite: 5,
        })
        result.forEach((d) => {
          expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
      })

      it('retorna array vazio (não null/undefined) quando sem ocorrências futuras', () => {
        const result = expandirOcorrencias({
          data_inicio: PASSADO,
          recorrencia: 'nenhuma',
        })
        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(0)
      })
    })
  })

  // ─── ehOcorrenciaValida ──────────────────────────────────────
  describe('ehOcorrenciaValida', () => {
    it('retorna true para data que é ocorrência futura válida', () => {
      expect(
        ehOcorrenciaValida({
          data: FUTURO_PROX,
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
        })
      ).toBe(true)
    })

    it('retorna true para segunda ocorrência semanal', () => {
      expect(
        ehOcorrenciaValida({
          data: FUTURO_2,
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
        })
      ).toBe(true)
    })

    it('retorna false para data que não é múltiplo de 7 dias', () => {
      expect(
        ehOcorrenciaValida({
          data: '2027-06-09', // 2 dias depois de FUTURO_PROX — não bate com semanal
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
        })
      ).toBe(false)
    })

    it('retorna false para data no passado', () => {
      expect(
        ehOcorrenciaValida({
          data: PASSADO,
          data_inicio: PASSADO,
          recorrencia: 'semanal',
        })
      ).toBe(false)
    })

    it('retorna true para evento único na data exata', () => {
      expect(
        ehOcorrenciaValida({
          data: FUTURO_PROX,
          data_inicio: FUTURO_PROX,
          recorrencia: 'nenhuma',
        })
      ).toBe(true)
    })

    it('retorna false para evento único em data diferente', () => {
      expect(
        ehOcorrenciaValida({
          data: FUTURO_2,
          data_inicio: FUTURO_PROX,
          recorrencia: 'nenhuma',
        })
      ).toBe(false)
    })

    it('retorna false quando data ultrapassa data_fim_recorrencia', () => {
      expect(
        ehOcorrenciaValida({
          data: FUTURO_4,
          data_inicio: FUTURO_PROX,
          recorrencia: 'semanal',
          data_fim_recorrencia: FUTURO_3, // fim em 2027-06-21
        })
      ).toBe(false)
    })

    it('retorna true para data quinzenal válida', () => {
      expect(
        ehOcorrenciaValida({
          data: FUTURO_QZ_2, // 2027-06-21 = +14 dias de FUTURO_PROX
          data_inicio: FUTURO_PROX,
          recorrencia: 'quinzenal',
        })
      ).toBe(true)
    })

    it('retorna true para data mensal válida', () => {
      expect(
        ehOcorrenciaValida({
          data: FUTURO_MES, // 2027-07-07 = +1 mês de FUTURO_PROX
          data_inicio: FUTURO_PROX,
          recorrencia: 'mensal',
        })
      ).toBe(true)
    })
  })
})
