import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LogIn } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function ConfirmarAcessoPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string }
}) {
  const { token, email } = searchParams

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo size="md" />
        </div>

        <Card>
          <CardContent className="p-8">
            {token && email ? (
              <form method="GET" action="/api/auth/callback/resend" className="space-y-5 text-center">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="callbackUrl" value="/admin" />

                <div>
                  <h2 className="text-xl font-serif font-semibold text-brand-dark">
                    Confirmar acesso
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Entrar no painel como <strong>{email}</strong>.
                  </p>
                </div>

                <Button type="submit" size="lg" className="w-full bg-brand hover:bg-brand-hover">
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar no painel
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Link inválido</h2>
                <p className="text-sm text-gray-500">
                  Este link está incompleto. Peça um novo link de acesso.
                </p>
                <a href="/auth/login" className="text-sm text-brand underline">
                  Voltar ao login
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
