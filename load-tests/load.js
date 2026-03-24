/**
 * Load Test — Casa de Vó Sebastiana
 *
 * Objetivo: simular carga típica de produção com múltiplos usuários
 * navegando pelo fluxo de agendamento ao mesmo tempo.
 *
 * Cenário: rampa de 0 → 20 VUs em 1min, mantém 20 VUs por 3min, desce em 30s
 * Total: ~5 minutos
 *
 * Uso:
 *   k6 run load-tests/load.js
 *   k6 run -e BASE_URL=https://casavosebastiana.com.br load-tests/load.js
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'
import {
  BASE_URL,
  DATA_FUTURA_TER,
  DATA_FUTURA_SAB,
  THRESHOLDS_SLOTS,
} from './config.js'

// Métricas customizadas
const slotsQueryDuration = new Trend('slots_query_duration', true)
const calendarLoadDuration = new Trend('calendar_load_duration', true)
const erros404 = new Counter('erros_404')

export const options = {
  stages: [
    { duration: '1m',   target: 20 },  // ramp-up
    { duration: '3m',   target: 20 },  // carga estável
    { duration: '30s',  target: 0  },  // ramp-down
  ],
  thresholds: {
    ...THRESHOLDS_SLOTS,
    // Calendário deve ser rápido mesmo sob carga
    calendar_load_duration: ['p(95)<2500'],
    // Slots (hot path + Supabase) podem ser um pouco mais lentos
    slots_query_duration:   ['p(95)<3000'],
  },
}

// Datas distribuídas para simular usuários buscando dias diferentes
const DATAS_TESTE = [
  '2027-07-13', // ter
  '2027-07-15', // qui
  '2027-07-17', // sáb
  '2027-07-20', // ter
  '2027-07-22', // qui
  '2027-07-24', // sáb
  '2027-08-05', // qui
  '2027-08-07', // sáb
]

function dataAleatoria() {
  return DATAS_TESTE[Math.floor(Math.random() * DATAS_TESTE.length)]
}

export default function () {
  const headers = { 'Accept': 'text/html,application/xhtml+xml' }

  // ── Fluxo 1: usuário navega pelo calendário ───────────────────
  group('fluxo_calendario', () => {
    const res = http.get(`${BASE_URL}/agendar`, { headers })

    calendarLoadDuration.add(res.timings.duration)

    check(res, {
      'calendario: 200':         (r) => r.status === 200,
      'calendario: tem datas':   (r) => r.body.includes('data') || r.body.length > 1000,
    })

    if (res.status === 404) erros404.add(1)
  })

  sleep(Math.random() * 1.5 + 0.5) // simula leitura: 0.5–2s

  // ── Fluxo 2: usuário seleciona uma data e vê os slots ─────────
  group('fluxo_slots', () => {
    const data = dataAleatoria()
    const res = http.get(`${BASE_URL}/agendar/${data}`, { headers })

    slotsQueryDuration.add(res.timings.duration)

    check(res, {
      'slots: status válido': (r) => [200, 404].includes(r.status),
      'slots: corpo presente': (r) => r.body.length > 500,
    })
  })

  sleep(Math.random() * 2 + 1) // simula escolha de horário: 1–3s

  // ── Fluxo 3: página de eventos públicos ───────────────────────
  group('fluxo_eventos', () => {
    const res = http.get(`${BASE_URL}/agendar/eventos`, { headers })
    check(res, {
      'eventos: 200': (r) => r.status === 200,
    })
  })

  sleep(Math.random() * 1 + 0.5)

  // ── Fluxo 4: consulta histórico (1 em 4 usuários) ─────────────
  if (Math.random() < 0.25) {
    group('fluxo_historico', () => {
      const res = http.get(`${BASE_URL}/historico`, { headers })
      check(res, {
        'historico: 200': (r) => r.status === 200,
      })
    })
    sleep(0.5)
  }
}
