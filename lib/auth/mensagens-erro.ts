// Códigos de erro do Auth.js que chegam em /auth/login?error=... → mensagem para o usuário.
export function mensagemDeErroDeLogin(codigo: string | null | undefined): string | null {
  if (!codigo) return null

  switch (codigo) {
    case 'Verification':
      return 'Link expirado ou já utilizado. Peça um novo link de acesso.'
    case 'AccessDenied':
      return 'Este e-mail não tem permissão de acesso ao painel.'
    default:
      return 'Não foi possível entrar. Peça um novo link de acesso.'
  }
}
