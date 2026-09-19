import { describe, it, expect } from 'vitest'
import { tokenizarTexto, removerFormatacao } from '@/lib/utils/texto-formatado'

describe('tokenizarTexto', () => {
  it('reconhece **negrito** e *itálico*', () => {
    expect(tokenizarTexto('a **b** c *d* e')).toEqual([
      { tipo: 'texto', valor: 'a ' },
      { tipo: 'negrito', valor: 'b' },
      { tipo: 'texto', valor: ' c ' },
      { tipo: 'italico', valor: 'd' },
      { tipo: 'texto', valor: ' e' },
    ])
  })

  it('mantém texto sem marcadores intacto (inclusive emojis e quebras de linha)', () => {
    expect(tokenizarTexto('🌿 linha 1\nlinha 2')).toEqual([{ tipo: 'texto', valor: '🌿 linha 1\nlinha 2' }])
  })

  it('não trata asteriscos soltos ou com espaço interno como formatação', () => {
    expect(tokenizarTexto('5 * 3 * 2')).toEqual([{ tipo: 'texto', valor: '5 * 3 * 2' }])
    expect(tokenizarTexto('** solto')).toEqual([{ tipo: 'texto', valor: '** solto' }])
    expect(tokenizarTexto('**sem fechar')).toEqual([{ tipo: 'texto', valor: '**sem fechar' }])
  })

  it('marcador não atravessa quebra de linha', () => {
    expect(tokenizarTexto('**a\nb**')).toEqual([{ tipo: 'texto', valor: '**a\nb**' }])
  })

  it('não interpreta HTML: tags viram texto literal', () => {
    expect(tokenizarTexto('<script>alert(1)</script> **ok**')).toEqual([
      { tipo: 'texto', valor: '<script>alert(1)</script> ' },
      { tipo: 'negrito', valor: 'ok' },
    ])
  })
})

describe('removerFormatacao', () => {
  it('remove marcadores e colapsa linhas para prévia de uma linha', () => {
    expect(removerFormatacao('**GIRA** de\n\nUmbanda *hoje*')).toBe('GIRA de Umbanda hoje')
  })

  it('devolve string vazia para texto vazio', () => {
    expect(removerFormatacao('  \n ')).toBe('')
  })
})
