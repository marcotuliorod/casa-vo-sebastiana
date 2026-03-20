'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { criarAgendamento, type EstadoFormAgendamento } from '@/lib/actions/booking'
import { formatarDataExtenso } from '@/lib/utils/date'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface BookingFormProps {
  data: string
  horaInicio: string
  horaFim: string
}

// Botão separado para usar useFormStatus corretamente dentro do form
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="xl"
      className="w-full bg-purple-700 hover:bg-purple-800"
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Confirmando...
        </>
      ) : (
        '✨ Confirmar Agendamento'
      )}
    </Button>
  )
}

export function BookingForm({ data, horaInicio, horaFim }: BookingFormProps) {
  const [estado, action] = useFormState<EstadoFormAgendamento, FormData>(
    criarAgendamento,
    null
  )

  return (
    <form action={action} className="space-y-5">
      {/* Campos ocultos com os dados do slot */}
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="hora_inicio" value={horaInicio} />
      <input type="hidden" name="hora_fim" value={horaFim} />

      {/* Resumo do horário escolhido */}
      <div className="rounded-xl bg-purple-50 p-4 text-center border border-purple-100">
        <p className="text-sm text-purple-600 font-medium">Você está agendando para:</p>
        <p className="text-lg font-bold text-purple-900 capitalize">{formatarDataExtenso(data)}</p>
        <p className="text-purple-700">
          {horaInicio} — {horaFim}
        </p>
      </div>

      {/* Erro geral */}
      {estado?.erro && !estado.campo && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 space-y-2">
          <p>{estado.erro}</p>
          {estado.erro.includes('horário') && (
            <Link
              href={`/agendar/${data}`}
              className="inline-flex items-center text-sm font-medium text-red-700 underline hover:text-red-800"
            >
              ← Escolher outro horário
            </Link>
          )}
        </div>
      )}

      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input
          id="nome"
          name="nome"
          placeholder="Seu nome completo"
          required
          autoComplete="name"
          className={estado?.campo === 'nome' ? 'border-red-400' : ''}
        />
        {estado?.campo === 'nome' && (
          <p className="text-xs text-red-600">{estado.erro}</p>
        )}
      </div>

      {/* Telefone */}
      <div className="space-y-1.5">
        <Label htmlFor="telefone">
          WhatsApp *{' '}
          <span className="font-normal text-gray-500 text-xs">(para confirmação)</span>
        </Label>
        <Input
          id="telefone"
          name="telefone"
          type="tel"
          placeholder="(11) 99999-9999"
          required
          autoComplete="tel"
          maxLength={15}
          onInput={(e) => {
            const input = e.currentTarget
            let v = input.value.replace(/\D/g, '')
            if (v.length > 11) v = v.slice(0, 11)
            if (v.length === 11) {
              // Celular: (11) 99999-9999
              input.value = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`
            } else if (v.length === 10) {
              // Fixo: (11) 3333-4444
              input.value = `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`
            } else if (v.length > 6) {
              input.value = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`
            } else if (v.length > 2) {
              input.value = `(${v.slice(0,2)}) ${v.slice(2)}`
            } else if (v.length > 0) {
              input.value = `(${v}`
            }
          }}
          className={estado?.campo === 'telefone' ? 'border-red-400' : ''}
        />
        {estado?.campo === 'telefone' && (
          <p className="text-xs text-red-600">
            {estado.erro === 'Telefone inválido'
              ? 'Informe um celular válido com DDD, ex: (11) 99999-9999'
              : estado.erro}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email{' '}
          <span className="font-normal text-gray-500 text-xs">(opcional)</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
        />
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="notas">
          Observações{' '}
          <span className="font-normal text-gray-500 text-xs">(opcional)</span>
        </Label>
        <Textarea
          id="notas"
          name="notas"
          placeholder="Algo que queira nos informar antes do atendimento..."
          rows={3}
          maxLength={500}
        />
      </div>

      <SubmitButton />

      <p className="text-center text-xs text-gray-400">
        Você receberá uma confirmação via WhatsApp
      </p>
    </form>
  )
}
