// Campo isca dos formulários públicos: invisível para quem usa o site, mas robôs
// que preenchem todos os campos do HTML caem nele. Sem dependências de servidor,
// porque o componente do formulário (cliente) também usa o nome do campo.

export const CAMPO_ISCA = 'website'
export const MENSAGEM_ISCA = 'Não foi possível concluir o pedido. Tente novamente.'

export function campoIscaPreenchido(formData: FormData): boolean {
  const valor = formData.get(CAMPO_ISCA)
  return typeof valor === 'string' && valor.trim() !== ''
}
