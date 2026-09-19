import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfirmarAcessoPage from '@/app/auth/confirmar/page'

function campo(container: HTMLElement, name: string) {
  return container.querySelector<HTMLInputElement>(`input[name="${name}"]`)
}

describe('página /auth/confirmar', () => {
  it('envia token e email ao callback do Auth.js via GET com o botão de entrada', () => {
    const { container } = render(ConfirmarAcessoPage({ searchParams: { token: 'tok123', email: 'a@b.com' } }))

    const form = container.querySelector('form')!
    expect(form.getAttribute('method')?.toUpperCase()).toBe('GET')
    expect(form.getAttribute('action')).toBe('/api/auth/callback/resend')
    expect(campo(container, 'token')?.value).toBe('tok123')
    expect(campo(container, 'email')?.value).toBe('a@b.com')
    expect(screen.getByRole('button', { name: /entrar no painel/i })).toBeTruthy()
  })

  it('sempre redireciona para /admin, ignorando callbackUrl vindo de links antigos', () => {
    const { container } = render(
      ConfirmarAcessoPage({
        searchParams: { token: 't', email: 'a@b.com', callbackUrl: 'https://agenda.mtrm.tech/auth/login' } as never,
      }),
    )

    expect(campo(container, 'callbackUrl')?.value).toBe('/admin')
  })

  it('mostra "Link inválido" quando faltam parâmetros', () => {
    const { container } = render(ConfirmarAcessoPage({ searchParams: {} }))

    expect(container.querySelector('form')).toBeNull()
    expect(screen.getByText(/link inválido/i)).toBeTruthy()
  })
})
