// Token de acesso ao histórico do consulente ("Meus Agendamentos").
//
// O histórico só abre por um link enviado ao e-mail do consulente. O link leva
// um token assinado com HMAC-SHA256 (chave derivada de AUTH_SECRET) que diz
// qual e-mail pode ser consultado e até quando. Sem tabela: o token se valida
// sozinho e expira em TTL_HISTORICO_MS.

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Validade do link enviado por e-mail (e do cookie que ele grava). */
export const TTL_HISTORICO_MS = 60 * 60 * 1000 // 1 hora

/** Cookie que guarda o token depois do clique no link (ver app/historico/acesso/route.ts). */
export const COOKIE_HISTORICO = 'cvs_historico'

interface Payload {
  /** e-mail em minúsculas */
  e: string
  /** expiração em ms desde a época */
  x: number
}

function chave(): string {
  const segredo = process.env.AUTH_SECRET
  if (!segredo) throw new Error('Histórico: configure AUTH_SECRET no .env')
  // Separação de domínio: a mesma AUTH_SECRET assina os JWTs do Auth.js
  return `historico-consulente:${segredo}`
}

function assinar(corpo: string): string {
  return createHmac('sha256', chave()).update(corpo).digest('base64url')
}

export function gerarTokenHistorico(email: string, agora = Date.now()): string {
  const payload: Payload = { e: email.trim().toLowerCase(), x: agora + TTL_HISTORICO_MS }
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${corpo}.${assinar(corpo)}`
}

export interface TokenHistoricoValido {
  email: string
  expiraEm: number
}

/** Devolve o e-mail e a expiração se o token for autêntico e ainda válido; senão null. */
export function verificarTokenHistorico(
  token: string | null | undefined,
  agora = Date.now()
): TokenHistoricoValido | null {
  if (!token) return null
  const partes = token.split('.')
  if (partes.length !== 2) return null
  const [corpo, assinatura] = partes

  const esperada = Buffer.from(assinar(corpo))
  const recebida = Buffer.from(assinatura)
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null

  let payload: Payload
  try {
    payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload?.e !== 'string' || typeof payload?.x !== 'number') return null
  if (payload.x <= agora) return null

  return { email: payload.e, expiraEm: payload.x }
}
