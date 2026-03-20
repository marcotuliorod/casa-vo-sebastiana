// Utilitários para normalização de telefone brasileiro

// Normaliza para E.164: +5511999999999
export function normalizarTelefone(telefone: string): string {
  // Remove tudo que não for número
  const somenteNumeros = telefone.replace(/\D/g, '')

  // Se já começa com 55 e tem 12-13 dígitos, adiciona +
  if (somenteNumeros.startsWith('55') && somenteNumeros.length >= 12) {
    return `+${somenteNumeros}`
  }

  // Se tem 10-11 dígitos (número brasileiro sem DDI)
  if (somenteNumeros.length === 10 || somenteNumeros.length === 11) {
    return `+55${somenteNumeros}`
  }

  return `+${somenteNumeros}`
}

// Formata para exibição: (11) 99999-9999
export function formatarTelefone(telefone: string): string {
  const nums = telefone.replace(/\D/g, '')
  // Remove o DDI 55 se presente
  const local = nums.startsWith('55') ? nums.slice(2) : nums

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }
  return telefone
}

// Valida telefone brasileiro (com ou sem DDI)
export function validarTelefone(telefone: string): boolean {
  const nums = telefone.replace(/\D/g, '')
  const local = nums.startsWith('55') ? nums.slice(2) : nums
  return local.length === 10 || local.length === 11
}
