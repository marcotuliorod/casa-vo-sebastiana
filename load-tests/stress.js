/**
 * Stress Test — Casa de Vó Sebastiana
 *
 * Objetivo: encontrar o ponto de ruptura do sistema aumentando
 * progressivamente a carga até 100 usuários simultâneos.
 *
 * ⚠️  Execute APENAS em ambiente local ou staging — nunca em produção
 *     sem avisar os usuários, pois pode degradar a experiência real.
 *
 * Uso:
 *   k6 run load-tests/stress.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'
import { BASE_URL, DATA_FUTURA_TER, DATA_FUTURA_SAB } from './config.js'

const taxaErro = new Rate('taxa_erro')

export const options = {
  stages: [
    { duration: '30s', target: 10  },  // aquecimento
    { duration: '1m',  target: 30  },  // carga normal
    { duration: '1m',  target: 60  },  // pressão
    { duration: '1m',  target: 100 },  // estresse
    { duration: '30s', target: 0   },  // recuperação
  ],
  thresholds: {
    // Threshold mais tolerante — objetivo é encontrar o limite, não reprovar
    http_req_duration: ['p(95)<5000'],
    // Aceita até 5% de erro antes de abortar
    taxa_erro: ['rate<0.05'],
  },
}

export default function () {
  const headers = { 'Accept': 'text/html,application/xhtml+xml' }

  // Alterna entre as rotas mais pesadas (DB queries)
  const rotas = [
    `${BASE_URL}/agendar`,
    `${BASE_URL}/agendar/${DATA_FUTURA_TER}`,
    `${BASE_URL}/agendar/${DATA_FUTURA_SAB}`,
    `${BASE_URL}/agendar/eventos`,
  ]

  const url = rotas[Math.floor(Math.random() * rotas.length)]
  const res = http.get(url, { headers })

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'sem erro 5xx': (r) => r.status < 500,
  })

  taxaErro.add(!ok)

  // Think time mínimo para simular pico real
  sleep(Math.random() * 0.5 + 0.1)
}
