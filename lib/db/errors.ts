// Helpers para tratar erros do driver `postgres` propagados pelo drizzle-orm.
// drizzle-orm envolve o erro original num DrizzleQueryError — o `code` do
// Postgres (ex: 23505 unique_violation, 23P01 exclusion_violation) fica em
// `.cause.code`, não no erro de nível superior — achado no teste de
// integração da Fase 1. Diferente do client supabase-js, que expunha
// `error.code` diretamente.

export function mensagemErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Erro desconhecido'
}

export function codigoPg(erro: unknown): string | undefined {
  if (erro && typeof erro === 'object' && 'cause' in erro) {
    const cause = (erro as { cause?: unknown }).cause
    if (cause && typeof cause === 'object' && 'code' in cause) {
      return (cause as { code?: string }).code
    }
  }
  return undefined
}
