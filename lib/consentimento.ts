// Autorização de uso dos dados (LGPD) e versão dos textos legais.
// Fica fora de lib/actions/booking.ts porque arquivos 'use server' só exportam funções.

export const MENSAGEM_CONSENTIMENTO = 'Para continuar, marque a autorização de uso dos seus dados.'

/**
 * Versão do texto da autorização e da Política de Privacidade. Mude a versão e a
 * data sempre que o texto mudar: cada cadastro guarda a versão que a pessoa aceitou
 * (prova do consentimento, LGPD art. 8º §2º).
 */
export const VERSAO_TEXTOS_LGPD = '1.0'
export const DATA_TEXTOS_LGPD = '2026-11-25'

/** Prazo de guarda do cadastro depois do último atendimento (apagado pelo cron). */
export const RETENCAO_CADASTRO_ANOS = 2

export const MENSAGEM_TELEFONE_DE_OUTRO_CADASTRO =
  'Este telefone já está cadastrado com outro e-mail. Use o mesmo e-mail do seu primeiro agendamento ou fale com a Casa.'
