// Utilitários de data para o fuso horário brasileiro (America/Sao_Paulo)

import { format, parseISO, addDays, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'

export const FUSO_HORARIO_BR = 'America/Sao_Paulo'

// Quantos dias à frente o calendário público oferece para agendar
export const DIAS_ANTECEDENCIA_AGENDAMENTO = 60

// Data de hoje no fuso BR, 'YYYY-MM-DD'
export function hojeBr(): string {
  return formatInTimeZone(new Date(), FUSO_HORARIO_BR, 'yyyy-MM-dd')
}

// Hora atual no fuso BR, 'HH:mm'
export function horaAgoraBr(): string {
  return formatInTimeZone(new Date(), FUSO_HORARIO_BR, 'HH:mm')
}

// Última data aberta para agendamento ('YYYY-MM-DD'), no fuso BR
export function dataLimiteAgendamento(): string {
  const limite = new Date(`${hojeBr()}T12:00:00Z`)
  limite.setUTCDate(limite.getUTCDate() + DIAS_ANTECEDENCIA_AGENDAMENTO)
  return limite.toISOString().slice(0, 10)
}

// Retorna a data atual no horário de Brasília
export function agora(): Date {
  return toZonedTime(new Date(), FUSO_HORARIO_BR)
}

// Formata data no padrão brasileiro
export function formatarData(data: string | Date): string {
  const d = typeof data === 'string' ? parseISO(data) : data
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

// Formata data por extenso
export function formatarDataExtenso(data: string | Date): string {
  const d = typeof data === 'string' ? parseISO(data) : data
  return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

/** Só a primeira letra maiúscula: "Sexta-feira, 27 de novembro de 2026" (o CSS capitalize deixaria "De Novembro De"). */
export function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Data por extenso para exibir sozinha (título, cartão): começa com maiúscula. */
export function formatarDataExtensoTitulo(data: string | Date): string {
  return primeiraMaiuscula(formatarDataExtenso(data))
}

// Retorna a data de amanhã no fuso BR como string 'YYYY-MM-DD'
export function amanha(): string {
  const hoje = toZonedTime(new Date(), FUSO_HORARIO_BR)
  return format(addDays(hoje, 1), 'yyyy-MM-dd')
}

// Verifica se uma data (string 'YYYY-MM-DD') é no passado
export function ehDataPassada(data: string): boolean {
  const hoje = startOfDay(toZonedTime(new Date(), FUSO_HORARIO_BR))
  const dataObj = parseISO(data)
  return isBefore(dataObj, hoje)
}

// Dia da semana de uma data (0=Dom, 1=Seg, ..., 6=Sáb)
export function diaDaSemana(data: string): number {
  return parseISO(data).getDay()
}

// Converte data e hora locais para UTC (para comparações)
export function paraUtc(data: string, hora: string): Date {
  const dataHoraLocal = new Date(`${data}T${hora}:00`)
  return fromZonedTime(dataHoraLocal, FUSO_HORARIO_BR)
}
