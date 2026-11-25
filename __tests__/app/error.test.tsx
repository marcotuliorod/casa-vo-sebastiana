import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Erro from '@/app/error'

describe('página de erro', () => {
  it('mostra mensagem em português e tenta de novo', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reset = vi.fn()
    render(<Erro error={Object.assign(new Error('falhou'), { digest: 'abc' })} reset={reset} />)
    expect(screen.getByText('Algo não saiu como esperado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(reset).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ir para a página inicial' })).toHaveAttribute('href', '/')
    vi.mocked(console.error).mockRestore()
  })
})
