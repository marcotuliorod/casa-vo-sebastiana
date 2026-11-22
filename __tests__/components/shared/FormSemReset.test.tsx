import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FormSemReset, useFormPending } from '@/components/shared/FormSemReset'

function Botao() {
  const pending = useFormPending()
  return <button type="submit">{pending ? 'Enviando' : 'Enviar'}</button>
}

describe('FormSemReset', () => {
  it('envia os campos para a action e não limpa o que foi digitado', async () => {
    const action = vi.fn()
    render(
      <FormSemReset action={action}>
        <input name="nome" aria-label="nome" defaultValue="" />
        <Botao />
      </FormSemReset>
    )

    const campo = screen.getByLabelText('nome') as HTMLInputElement
    fireEvent.change(campo, { target: { value: 'Maria' } })
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(action).toHaveBeenCalledOnce())
    const fd = action.mock.calls[0][0] as FormData
    expect(fd.get('nome')).toBe('Maria')
    expect(campo.value).toBe('Maria')
  })

  it('expõe pending enquanto a action está em andamento', async () => {
    let concluir!: () => void
    const action = vi.fn(() => new Promise<void>((r) => (concluir = r)))
    render(
      <FormSemReset action={action}>
        <Botao />
      </FormSemReset>
    )

    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('Enviando'))
    concluir()
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('Enviar'))
  })
})

describe('FormSemReset — limparApos', () => {
  it('limpa os campos quando limparApos muda para um valor de sucesso', () => {
    const { rerender } = render(
      <FormSemReset action={vi.fn()} limparApos={null}>
        <input name="nome" aria-label="nome" defaultValue="" />
      </FormSemReset>
    )
    const campo = screen.getByLabelText('nome') as HTMLInputElement
    fireEvent.change(campo, { target: { value: 'Maria' } })

    rerender(
      <FormSemReset action={vi.fn()} limparApos={{ ok: true }}>
        <input name="nome" aria-label="nome" defaultValue="" />
      </FormSemReset>
    )
    expect(campo.value).toBe('')
  })
})
