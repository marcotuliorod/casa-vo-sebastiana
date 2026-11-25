import type { MetadataRoute } from 'next'

// Buscadores podem ler as páginas públicas. As páginas com dados pessoais (agendamento,
// histórico, portal do médium, login) ficam fora pelo `noindex` delas — e por isso não
// são bloqueadas aqui: bloqueadas, o buscador não leria o `noindex` e poderia listar o
// endereço de um link compartilhado.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
  }
}
