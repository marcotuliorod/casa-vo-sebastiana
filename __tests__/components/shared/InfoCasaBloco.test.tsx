import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InfoCasaBloco } from '@/components/shared/InfoCasaBloco'
import { INFO_CASA_VAZIA } from '@/lib/queries/casa'

const COMPLETA = {
  ...INFO_CASA_VAZIA,
  endereco: 'Rua das Flores, 10',
  linkMapa: 'https://maps.app.goo.gl/abc',
  emailContato: 'casa@exemplo.com',
  telefoneContato: '(11) 99999-9999',
  orientacoes: 'Chegue 15 minutos antes.',
  politicaCancelamento: 'Cancele pelo link do e-mail.',
}

describe('InfoCasaBloco', () => {
  const original = process.env.EMAIL_REPLY_TO
  afterEach(() => {
    process.env.EMAIL_REPLY_TO = original
  })

  it('não mostra nada quando não há informações', () => {
    delete process.env.EMAIL_REPLY_TO
    const { container } = render(<InfoCasaBloco info={INFO_CASA_VAZIA} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra endereço, link do mapa em nova aba e contatos clicáveis', () => {
    render(<InfoCasaBloco info={COMPLETA} />)
    expect(screen.getByText('Rua das Flores, 10')).toBeInTheDocument()
    const mapa = screen.getByRole('link', { name: 'Ver no mapa' })
    expect(mapa).toHaveAttribute('href', 'https://maps.app.goo.gl/abc')
    expect(mapa).toHaveAttribute('target', '_blank')
    expect(mapa).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'casa@exemplo.com' })).toHaveAttribute('href', 'mailto:casa@exemplo.com')
    expect(screen.getByRole('link', { name: '(11) 99999-9999' })).toHaveAttribute('href', 'tel:11999999999')
  })

  it('orientações e política só aparecem quando pedidas (página do agendamento)', () => {
    const { rerender } = render(<InfoCasaBloco info={COMPLETA} />)
    expect(screen.queryByText('Chegue 15 minutos antes.')).not.toBeInTheDocument()
    rerender(<InfoCasaBloco info={COMPLETA} comOrientacoes />)
    expect(screen.getByText('Chegue 15 minutos antes.')).toBeInTheDocument()
    expect(screen.getByText('Cancele pelo link do e-mail.')).toBeInTheDocument()
  })

  it('usa o EMAIL_REPLY_TO do servidor quando a Casa não preencheu e-mail', () => {
    process.env.EMAIL_REPLY_TO = 'Casa <resposta@exemplo.com>'
    render(<InfoCasaBloco info={INFO_CASA_VAZIA} />)
    expect(screen.getByRole('link', { name: 'resposta@exemplo.com' })).toBeInTheDocument()
  })
})
