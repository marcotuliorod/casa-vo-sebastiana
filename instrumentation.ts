// Roda uma vez quando o servidor Next sobe (não no build).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { verificarConfiguracao } = await import('./lib/config/verificar')
  const { erros, avisos } = verificarConfiguracao()
  for (const aviso of avisos) console.warn(`[Configuração] ${aviso}`)
  for (const erro of erros) console.error(`[Configuração] ${erro}`)
  if (erros.length && process.env.NODE_ENV === 'production') {
    throw new Error(`Configuração incompleta no .env: ${erros.join(' ')}`)
  }
}
