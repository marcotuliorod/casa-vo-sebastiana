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
    const link = screen.getByRole('link', { name: 'contato@exemplo.com' })
    expect(link).toHaveAttribute('href', 'mailto:contato@exemplo.com')
  })

  it('o e-mail de contato da tela "Informações da Casa" tem preferência', async () => {
    process.env.EMAIL_REPLY_TO = 'outro@exemplo.com'
    getInfoCasa.mockResolvedValue({ ...INFO_CASA_VAZIA, emailContato: 'casa@exemplo.com' })
    await renderPagina()
    expect(screen.getByRole('link', { name: 'casa@exemplo.com' })).toHaveAttribute('href', 'mailto:casa@exemplo.com')
    expect(screen.queryByText('outro@exemplo.com')).not.toBeInTheDocument()
  })

  it('sem e-mail de contato, orienta a responder um e-mail da Casa', async () => {
    delete process.env.EMAIL_REPLY_TO
    await renderPagina()
    expect(screen.getByText(/responda qualquer e-mail que você recebeu da Casa/)).toBeInTheDocument()
  })

  it('mostra o responsável pelos dados quando preenchido', async () => {
    getInfoCasa.mockResolvedValue({ ...INFO_CASA_VAZIA, responsavelDados: 'Associação Casa de Vó Sebastiana' })
    await renderPagina()
    expect(screen.getByText('Quem cuida dos seus dados')).toBeInTheDocument()
    expect(screen.getByText('Associação Casa de Vó Sebastiana')).toBeInTheDocument()
  })

  it('sem responsável preenchido, a seção não aparece', async () => {
    await renderPagina()
    expect(screen.queryByText('Quem cuida dos seus dados')).not.toBeInTheDocument()
  })

  it('explica os direitos de ver, corrigir e apagar', async () => {
    await renderPagina()
    expect(screen.getByText(/ver, corrigir ou apagar seus dados/)).toBeInTheDocument()
  })
})
