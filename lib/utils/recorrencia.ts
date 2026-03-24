// Engine pura de recorrência — sem I/O, fácil de testar unitariamente
import { parseISO, addWeeks, addMonths, format, isBefore, isAfter } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import type { RecorrenciaTipo } from '@/types/database'

const FUSO_BR = 'America/Sao_Paulo'
const LIMITE_PADRAO = 52 // ~1 ano de eventos semanais

/**
 * Expande um evento recorrente em datas concretas (futuras ou de hoje em diante).
 * Retorna strings 'YYYY-MM-DD' ordenadas crescentemente.
 */
export function expandirOcorrencias(params: {
  data_inicio: string
  recorrencia: RecorrenciaTipo
  data_fim_recorrencia?: string | null
  limite?: number
}): string[] {
  const {
    data_inicio,
    recorrencia,
    data_fim_recorrencia,
    limite = LIMITE_PADRAO,
  } = params

  const hojeStr = formatInTimeZone(new Date(), FUSO_BR, 'yyyy-MM-dd')
  const hoje = parseISO(hojeStr)
  const inicio = parseISO(data_inicio)
  const fimRecorrencia = data_fim_recorrencia ? parseISO(data_fim_recorrencia) : null

  // Evento único
  if (recorrencia === 'nenhuma') {
    return isBefore(inicio, hoje) ? [] : [data_inicio]
  }

  const ocorrencias: string[] = []
  let atual = inicio
  let iteracoes = 0

  while (iteracoes < limite) {
    // Para se ultrapassou a data fim da recorrência
    if (fimRecorrencia && isAfter(atual, fimRecorrencia)) break

    // Só inclui datas de hoje em diante
    if (!isBefore(atual, hoje)) {
      ocorrencias.push(format(atual, 'yyyy-MM-dd'))
    }

    // Avança para a próxima ocorrência
    switch (recorrencia) {
      case 'semanal':
        atual = addWeeks(atual, 1)
        break
      case 'quinzenal':
        atual = addWeeks(atual, 2)
        break
      case 'mensal':
        atual = addMonths(atual, 1)
        break
    }

    iteracoes++
  }

  return ocorrencias
}

/**
 * Verifica se uma data específica é uma ocorrência válida de um evento.
 */
export function ehOcorrenciaValida(params: {
  data: string
  data_inicio: string
  recorrencia: RecorrenciaTipo
  data_fim_recorrencia?: string | null
}): boolean {
  const ocorrencias = expandirOcorrencias({
    data_inicio: params.data_inicio,
    recorrencia: params.recorrencia,
    data_fim_recorrencia: params.data_fim_recorrencia,
    limite: 104, // busca mais ampla para validação
  })
  return ocorrencias.includes(params.data)
}
