'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cancelarAgendamento } from '@/lib/actions/booking'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  params: Promise<{ token: string }>
}

export default function CancelarPage({ params }: Props) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [cancelado, setCancelado] = useState(false)

  const handleCancelar = async () => {
    const { token } = await params
    startTransition(async () => {
      const resultado = await cancelarAgendamento(token)
      if (resultado.erro) {
        setErro(resultado.erro)
      } else {
        setCancelado(true)
        setTimeout(() => router.push(`/agendamento/${token}`), 2000)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-background to-background">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="text-center mb-8">
          <Logo size="sm" />
        </div>

        <Card>
          <CardContent className="p-8 text-center space-y-4">
            {cancelado ? (
              <>
                <p className="text-3xl">✅</p>
                <h2 className="text-xl font-semibold text-gray-800">
                  Agendamento cancelado
                </h2>
                <p className="text-sm text-gray-500">Redirecionando...</p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                <h2 className="text-xl font-serif font-semibold text-gray-800">
                  Cancelar agendamento?
                </h2>
                <p className="text-sm text-gray-500">
                  Esta ação não pode ser desfeita. Você receberá uma mensagem de
                  confirmação no WhatsApp.
                </p>

                {erro && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {erro}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    asChild
                  >
                    <Link href="..">Voltar</Link>
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleCancelar}
                  >
                    Sim, cancelar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
