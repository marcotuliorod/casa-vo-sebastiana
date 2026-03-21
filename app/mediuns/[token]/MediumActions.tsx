'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assumirAgendamento, liberarAgendamento } from '@/lib/actions/mediuns'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface MediumActionsProps {
  agendamentoId: string
  mediumToken: string
  tipo: 'assumir' | 'liberar'
}

export function MediumActions({ agendamentoId, mediumToken, tipo }: MediumActionsProps) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    setErro(null)
    startTransition(async () => {
      const resultado =
        tipo === 'assumir'
          ? await assumirAgendamento(agendamentoId, mediumToken)
          : await liberarAgendamento(agendamentoId, mediumToken)

      if (resultado.erro) {
        setErro(resultado.erro)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={tipo === 'assumir' ? 'default' : 'outline'}
        onClick={handleClick}
        disabled={isPending}
        className={
          tipo === 'assumir'
            ? 'bg-purple-700 hover:bg-purple-800 text-white'
            : 'text-gray-500 border-gray-200 hover:bg-gray-50'
        }
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : tipo === 'assumir' ? (
          'Assumir atendimento'
        ) : (
          'Liberar'
        )}
      </Button>
      {erro && <p className="text-xs text-red-500">{erro}</p>}
    </div>
  )
}
