// Formatação leve para textos digitados no painel (ex.: descrição de eventos):
// **negrito** e *itálico*. Quebras de linha são preservadas pelo CSS na exibição.
// Gera segmentos (não HTML), então nada digitado é interpretado como marcação.

export type SegmentoTexto = { tipo: 'texto' | 'negrito' | 'italico'; valor: string }

// Marcadores só valem numa mesma linha e sem espaço colado por dentro
// ("5 * 3 * 2" continua literal).
function fechamento(texto: string, inicio: number, marcador: string): number {
  const fim = texto.indexOf(marcador, inicio)
  if (fim <= inicio) return -1

  const conteudo = texto.slice(inicio, fim)
  if (conteudo.includes('\n')) return -1
  if (/^\s|\s$/.test(conteudo)) return -1
  if (marcador === '*' && conteudo.includes('*')) return -1
  return fim
}

export function tokenizarTexto(texto: string): SegmentoTexto[] {
  const segmentos: SegmentoTexto[] = []
  let buffer = ''

  const descarregar = () => {
    if (buffer) segmentos.push({ tipo: 'texto', valor: buffer })
    buffer = ''
  }

  let i = 0
  while (i < texto.length) {
    if (texto.startsWith('**', i)) {
      const fim = fechamento(texto, i + 2, '**')
      if (fim !== -1) {
        descarregar()
        segmentos.push({ tipo: 'negrito', valor: texto.slice(i + 2, fim) })
        i = fim + 2
        continue
      }
    } else if (texto[i] === '*') {
      const fim = fechamento(texto, i + 1, '*')
      if (fim !== -1) {
        descarregar()
        segmentos.push({ tipo: 'italico', valor: texto.slice(i + 1, fim) })
        i = fim + 1
        continue
      }
    }

    buffer += texto[i]
    i++
  }

  descarregar()
  return segmentos
}

// Para prévias de uma linha (listas): sem marcadores e com espaços/linhas colapsados.
export function removerFormatacao(texto: string): string {
  return tokenizarTexto(texto)
    .map((s) => s.valor)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
