import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacidadePage from '@/app/privacidade/page'

describe('página de privacidade', () => {
  const original = process.env.EMAIL_REPLY_TO
  afterEach(() => {
    process.env.EMAIL_REPLY_TO = original
  })

  it('mostra o e-mail de contato quando EMAIL_REPLY_TO está configurado', () => {
    process.env.EMAIL_REPLY_TO = 'Casa de Vó Sebastiana <contato@exemplo.com>'
    render(<PrivacidadePage />)
    const link = screen.getByRole('link', { name: 'contato@exemplo.com' })
    expect(link).toHaveAttribute('href', 'mailto:contato@exemplo.com')
  })

  it('sem e-mail de contato, orienta a responder um e-mail da Casa', () => {
    delete process.env.EMAIL_REPLY_TO
    render(<PrivacidadePage />)
    expect(screen.getByText(/responda qualquer e-mail que você recebeu da Casa/)).toBeInTheDocument()
  })

  it('explica os direitos de ver, corrigir e apagar', () => {
    render(<PrivacidadePage />)
    expect(screen.getByText(/ver, corrigir ou apagar seus dados/)).toBeInTheDocument()
  })
})
