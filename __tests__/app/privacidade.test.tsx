import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const getInfoCasa = vi.fn()
vi.mock('@/lib/queries/casa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/queries/casa')>()),
  getInfoCasa: () => getInfoCasa(),
}))

import PrivacidadePage from '@/app/privacidade/page'
import { INFO_CASA_VAZIA } from '@/lib/queries/casa'

async function renderPagina() {
  render(await PrivacidadePage())
}

describe('página de privacidade', () => {
  const original = process.env.EMAIL_REPLY_TO
  beforeEach(() => {
    getInfoCasa.mockResolvedValue(INFO_CASA_VAZIA)
  })
  afterEach(() => {
    process.env.EMAIL_REPLY_TO = original
  })

  it('mostra o e-mail de contato quando EMAIL_REPLY_TO está configurado', async () => {
    process.env.EMAIL_REPLY_TO = 'Casa de Vó Sebastiana <contato@exemplo.com>'
    await renderPagina()
    const links = screen.getAllByRole('link', { name: 'contato@exemplo.com' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute('href', 'mailto:contato@exemplo.com')
  })

  it('o e-mail de contato da tela "Informações da Casa" tem preferência', async () => {
    process.env.EMAIL_REPLY_TO = 'outro@exemplo.com'
    getInfoCasa.mockResolvedValue({ ...INFO_CASA_VAZIA, emailContato: 'casa@exemplo.com' })
    await renderPagina()
    expect(screen.getAllByRole('link', { name: 'casa@exemplo.com' })[0]).toHaveAttribute('href', 'mailto:casa@exemplo.com')
    expect(screen.queryByText('outro@exemplo.com')).not.toBeInTheDocument()
  })

  it('sem e-mail de contato, orienta a falar com a Casa pessoalmente', async () => {
    delete process.env.EMAIL_REPLY_TO
    await renderPagina()
    expect(screen.getByText(/fale com a Casa pessoalmente/)).toBeInTheDocument()
  })

  it('mostra o responsável pelos dados quando preenchido', async () => {
    getInfoCasa.mockResolvedValue({ ...INFO_CASA_VAZIA, responsavelDados: 'Associação Casa de Vó Sebastiana' })
    await renderPagina()
    expect(screen.getByText('Quem cuida dos seus dados')).toBeInTheDocument()
    expect(screen.getByText('Associação Casa de Vó Sebastiana')).toBeInTheDocument()
  })

  it('sem responsável preenchido, a seção continua visível e cita a direção da Casa', async () => {
    await renderPagina()
    expect(screen.getByText('Quem cuida dos seus dados')).toBeInTheDocument()
    expect(screen.getByText(/responsabilidade da direção da Casa de Vó Sebastiana/)).toBeInTheDocument()
  })

  it('traz envio ao exterior, prazos, menores, ANPD e a versão do texto', async () => {
    await renderPagina()
    expect(screen.getByText('Dados enviados para fora do Brasil')).toBeInTheDocument()
    expect(screen.getByText(/até 2 anos depois do seu último/)).toBeInTheDocument()
    expect(screen.getByText(/maiores de 18 anos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'gov.br/anpd' })).toHaveAttribute('href', 'https://www.gov.br/anpd')
    expect(screen.getByText(/Versão 1\.0, de 25\/11\/2026/)).toBeInTheDocument()
  })

  it('lista os direitos e o prazo de resposta', async () => {
    await renderPagina()
    expect(screen.getByText(/saber se temos dados seus/)).toBeInTheDocument()
    expect(screen.getByText(/pedir uma cópia dos seus dados/)).toBeInTheDocument()
    expect(screen.getByText(/retirar a autorização e pedir que tudo seja apagado/)).toBeInTheDocument()
    expect(screen.getByText(/Respondemos em até 15 dias/)).toBeInTheDocument()
  })
})
