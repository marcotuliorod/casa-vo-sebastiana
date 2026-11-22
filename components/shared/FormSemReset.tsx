'use client'

// No React 19, <form action={fn}> limpa os campos não controlados depois de
// toda submissão — inclusive quando a Server Action devolve erro de validação,
// o que apagaria o que a pessoa digitou. Este form envia pela mesma action
// (dispatch do useActionState) via startTransition, sem o reset automático.
//
// Os botões de envio leem o "enviando" com useFormPending() (substitui
// useFormStatus, que só funciona com o atributo action do <form>).

import { createContext, useContext, useEffect, useRef, useTransition, type ComponentProps, type FormEvent } from 'react'

const FormPendingContext = createContext(false)

type Props = Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: (formData: FormData) => void
  /**
   * Limpa os campos quando este valor muda para algo "truthy" — passe o estado
   * da action só quando ela deu certo (ex.: `estado && !estado.erro ? estado : null`).
   * Em erro o form mantém o que foi digitado.
   */
  limparApos?: unknown
}

export function FormSemReset({ action, limparApos, children, ...props }: Props) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (limparApos) formRef.current?.reset()
  }, [limparApos])

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(e.currentTarget, submitter ?? undefined)
    startTransition(() => action(formData))
  }

  return (
    <FormPendingContext.Provider value={pending}>
      <form {...props} ref={formRef} onSubmit={onSubmit}>
        {children}
      </form>
    </FormPendingContext.Provider>
  )
}

/** true enquanto a action do FormSemReset mais próximo está em andamento. */
export function useFormPending(): boolean {
  return useContext(FormPendingContext)
}
