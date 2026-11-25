// Limite de tentativas nas ações públicas (agendar, inscrever-se em evento,
// pedir o link do histórico).
//
// Fica na memória do processo: o app roda num único container, então um mapa
// basta. Um restart zera as contagens — aceitável, o objetivo é frear abuso
// (lotar a agenda, disparar e-mails em massa), não contabilidade exata.

import { headers } from 'next/headers'

export const MENSAGEM_LIMITE = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'

export const MENSAGEM_LIMITE_EMAIL =
  'Este e-mail já fez vários pedidos hoje. Aguarde a resposta da Casa ou tente novamente amanhã.'


/** Limites usados pelas actions: máximo de tentativas por janela. */
export const LIMITES = {
  agendarPorIp: { max: 10, janelaMs: 60 * 60 * 1000 },
  eventoPorIp: { max: 10, janelaMs: 60 * 60 * 1000 },
  historicoPorIp: { max: 5, janelaMs: 15 * 60 * 1000 },
  historicoPorEmail: { max: 3, janelaMs: 60 * 60 * 1000 },
  // Cada pedido manda e-mail para o endereço digitado: freia o uso do site para
  // disparar e-mails a terceiros (protege a reputação do domínio no Resend).
  pedidosPorEmail: { max: 3, janelaMs: 24 * 60 * 60 * 1000 },
  // Link de login do painel (só e-mails autorizados recebem; freia insistência)
  loginPorEmail: { max: 5, janelaMs: 60 * 60 * 1000 },
} as const

const MAIOR_JANELA_MS = Math.max(...Object.values(LIMITES).map((l) => l.janelaMs))

export interface Limite {
  max: number
  janelaMs: number
}

const MAX_CHAVES = 10_000

// chave → instantes (ms) das tentativas dentro da janela
const tentativas = new Map<string, number[]>()

function limpar(agora: number) {
  for (const [chave, lista] of tentativas) {
    // Sem saber a janela de cada chave, descarta o que passou da maior delas
    if (lista.length === 0 || lista[lista.length - 1] <= agora - MAIOR_JANELA_MS) {
      tentativas.delete(chave)
    }
  }
}

/**
 * Registra uma tentativa e diz se ela está dentro do limite.
 * Janela deslizante: conta as tentativas dos últimos `janelaMs`.
 * Tentativas recusadas não contam (quem espera volta a conseguir).
 */
export function consumirLimite(chave: string, { max, janelaMs }: Limite, agora = Date.now()): boolean {
  if (tentativas.size > MAX_CHAVES) limpar(agora)

  const recentes = (tentativas.get(chave) ?? []).filter((t) => t > agora - janelaMs)
  if (recentes.length >= max) {
    tentativas.set(chave, recentes)
    return false
  }
  recentes.push(agora)
  tentativas.set(chave, recentes)
  return true
}

/** Zera todas as contagens (testes). */
export function zerarLimites(): void {
  tentativas.clear()
}

/**
 * IP de quem fez a requisição. Em produção o app fica atrás do Traefik (ou do
 * Caddy), que preenche X-Real-Ip / X-Forwarded-For. Do X-Forwarded-For usa o
 * último endereço — o que o nosso proxy acrescentou —, porque os anteriores
 * podem ter sido inventados pelo cliente.
 */
export async function ipDaRequisicao(): Promise<string> {
  try {
    const h = await headers()
    const real = h.get('x-real-ip')?.trim()
    if (real) return real
    const encaminhado = h.get('x-forwarded-for')
    const ultimo = encaminhado?.split(',').map((p) => p.trim()).filter(Boolean).pop()
    return ultimo || 'desconhecido'
  } catch {
    // Fora de uma requisição (ex.: testes)
    return 'desconhecido'
  }
}
