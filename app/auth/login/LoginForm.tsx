'use client'

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { signIn } from 'next-auth/react'
import { Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { mensagemDeErroDeLogin } from '@/lib/auth/mensagens-erro'

export function LoginForm() {
  const erroDaUrl = mensagemDeErroDeLogin(useSearchParams().get('error'))
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, startTransition] = useTransition()

  const handleEnviarLink = (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    startTransition(async () => {
      const resultado = await signIn('resend', { email, redirect: false, callbackUrl: '/admin' })

      if (resultado?.error) {
        setErro('Erro ao enviar o link. Verifique o email e tente novamente.')
      } else {
        setEnviado(true)
      }
    })
  }

  const mensagemDeErro = erro ?? erroDaUrl

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size="md" />
        </div>

        <Card>
          <CardContent className="p-8">
            {enviado ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-brand-success mx-auto" />
                <h2 className="text-lg font-semibold text-gray-800">
                  Link enviado!
                </h2>
                <p className="text-sm text-gray-500">
                  Verifique sua caixa de entrada em{' '}
                  <strong>{email}</strong> e clique no link para acessar o painel.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEnviarLink} className="space-y-5">
                <div className="text-center mb-2">
                  <h2 className="text-xl font-serif font-semibold text-brand-dark">
                    Acesso Administrativo
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Insira seu email para receber o link de acesso.
                  </p>
                </div>

                {mensagemDeErro && (
                  <div
                    role="alert"
                    className="rounded-lg bg-brand-error/10 border border-brand-error/30 p-3 text-sm text-brand-error"
                  >
                    {mensagemDeErro}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@casavosebastiana.com.br"
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-brand hover:bg-brand-hover"
                  disabled={pendente}
                >
                  {pendente ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar link de acesso
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
