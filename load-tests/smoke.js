/**
 * Smoke Test — Casa de Vó Sebastiana
 *
 * Objetivo: verificar que todas as rotas críticas respondem corretamente
 * com 1 usuário virtual. Roda em ~30s.
 *
 * Uso:
 *   k6 run load-tests/smoke.js
 *   k6 run -e BASE_URL=https://casavosebastiana.com.br load-tests/smoke.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, DATA_FUTURA_TER, DATA_FUTURA_SAB, THRESHOLDS_PADRAO } from './config.js'

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: THRESHOLDS_PADRAO,
}

export default function () {
  const headers = { 'Accept': 'text/html,application/xhtml+xml' }

  // ── 1. Home (redirect para /agendar) ──────────────────────────
  {
    const res = http.get(`${BASE_URL}/`, { headers })
    check(res, {
      'home: status 200 ou 307/308': (r) => [200, 307, 308].includes(r.status),
    })
  }

  sleep(0.5)

  // ── 2. Calendário de agendamento ──────────────────────────────
  {
    const res = http.get(`${BASE_URL}/agendar`, { headers })
    check(res, {
      'agendar: status 200':       (r) => r.status === 200,
      'agendar: contém calendário': (r) => r.body.includes('Escolha uma data'),
      'agendar: tempo < 3s':        (r) => r.timings.duration < 3000,
    })
  }

  sleep(0.5)

  // ── 3. Slots para terça-feira futura ──────────────────────────
  {
    const res = http.get(`${BASE_URL}/agendar/${DATA_FUTURA_TER}`, {
      headers,
      responseCallback: http.expectedStatuses(200, 404),
    })
    check(res, {
      'slots terça: status 200 ou 404': (r) => [200, 404].includes(r.status),
      'slots terça: tempo < 3s':        (r) => r.timings.duration < 3000,
    })
  }

  sleep(0.5)

  // ── 4. Slots para sábado futuro ───────────────────────────────
  {
    const res = http.get(`${BASE_URL}/agendar/${DATA_FUTURA_SAB}`, {
      headers,
      responseCallback: http.expectedStatuses(200, 404),
    })
    check(res, {
      'slots sábado: status 200 ou 404': (r) => [200, 404].includes(r.status),
      'slots sábado: tempo < 3s':         (r) => r.timings.duration < 3000,
    })
  }

  sleep(0.5)

  // ── 5. Rota de eventos públicos ───────────────────────────────
  {
    const res = http.get(`${BASE_URL}/agendar/eventos`, { headers })
    check(res, {
      'eventos: status 200': (r) => r.status === 200,
      'eventos: tempo < 3s': (r) => r.timings.duration < 3000,
    })
  }

  sleep(0.5)

  // ── 6. Histórico ──────────────────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/historico`, { headers })
    check(res, {
      'historico: status 200': (r) => r.status === 200,
    })
  }

  sleep(0.5)

  // ── 7. Admin sem sessão → redireciona para login ──────────────
  {
    const res = http.get(`${BASE_URL}/admin`, {
      headers,
      redirects: 0,
      // 307 é correto — não deve ser contado como falha
      responseCallback: http.expectedStatuses(200, 301, 302, 307, 308),
    })
    check(res, {
      'admin sem sessão: redireciona': (r) => [307, 308, 302].includes(r.status),
    })
  }

  sleep(0.5)

  // ── 8. Cron sem token → 401 ───────────────────────────────────
  {
    const res = http.get(`${BASE_URL}/api/cron/lembretes`, {
      // 401 é correto — não deve ser contado como falha
      responseCallback: http.expectedStatuses(401),
    })
    check(res, {
      'cron sem auth: 401': (r) => r.status === 401,
    })
  }

  sleep(1)
}
