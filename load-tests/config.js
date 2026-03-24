/**
 * Configuração compartilhada dos testes de carga
 * Altere BASE_URL antes de rodar contra produção.
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Datas futuras estáveis para os testes
export const DATA_FUTURA_TER = '2027-07-13' // terça-feira (dia útil)
export const DATA_FUTURA_SAB = '2027-07-17' // sábado (dia de pico)
export const DATA_PASSADA     = '2025-01-01' // passada (deve retornar vazio)

// Thresholds padrão — podem ser sobrescritos por cenário
export const THRESHOLDS_PADRAO = {
  // 95% das requisições devem completar em < 2s
  http_req_duration: ['p(95)<2000'],
  // Menos de 1% de erros HTTP
  http_req_failed:   ['rate<0.01'],
}

// Thresholds mais rigorosos para a rota de slots (hot path do sistema)
export const THRESHOLDS_SLOTS = {
  http_req_duration: ['p(50)<800', 'p(95)<2000', 'p(99)<3000'],
  http_req_failed:   ['rate<0.01'],
}
