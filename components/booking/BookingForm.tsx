'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { criarAgendamento, type EstadoFormAgendamento } from '@/lib/actions/booking'
import { formatarDataExtenso } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface BookingFormProps {
  data: string
  horaInicio: string
  horaFim: string
}

function usePhoneMask() {
  const [value, setValue] = useState('')

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    let v = e.currentTarget.value.replace(/\D/g, '')
    if (v.length > 11) v = v.slice(0, 11)
    let formatted = v
    if (v.length === 11) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
    } else if (v.length === 10) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`
    } else if (v.length > 6) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
    } else if (v.length > 2) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2)}`
    } else if (v.length > 0) {
      formatted = `(${v}`
    }
    setValue(formatted)
  }

  return [value, handleInput] as const
}

function AppointmentSummary({ data, horaInicio, horaFim }: BookingFormProps) {
  return (
    <div className="rounded-xl bg-brand-areia/40 p-4 text-center border border-brand-muted/30">
      <p className="text-sm text-brand font-medium">Você está agendando para:</p>
      <p className="text-lg font-bold text-brand-dark capitalize">{formatarDataExtenso(data)}</p>
      <p className="text-brand">
        {horaInicio} — {horaFim}
      </p>
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="xl"
      className="w-full bg-brand hover:bg-brand-hover"
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
  const [nome, setNome] = useState('')
  const [telefone, handleTelefoneInput] = usePhoneMask()
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const NOTAS_MAX = 500

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="hora_inicio" value={horaInicio} />
      <input type="hidden" name="hora_fim" value={horaFim} />

      <AppointmentSummary data={data} horaInicio={horaInicio} horaFim={horaFim} />

      {estado?.erro && !estado.campo && (
        <div className="rounded-lg bg-brand-error/10 border border-brand-error/30 p-3 text-sm text-brand-error space-y-2">
          <p>{estado.erro}</p>
          {estado.erro.includes('horário') && (
            <Link
              href={`/agendar/${data}`}
              className="inline-flex items-center text-sm font-medium text-brand-error underline hover:opacity-80"
            >
              ← Escolher outro horário
            </Link>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input
          id="nome"
          name="nome"
          placeholder="Seu nome completo"
          required
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={cn(estado?.campo === 'nome' && 'border-brand-error')}
        />
        {estado?.campo === 'nome' && (
          <p className="text-xs text-brand-error">{estado.erro}</p>
        )}
      </div>

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
          value={telefone}
          onInput={handleTelefoneInput}
          className={cn(estado?.campo === 'telefone' && 'border-brand-error')}
        />
        {estado?.campo === 'telefone' && (
          <p className="text-xs text-brand-error">
            {estado.erro === 'Telefone inválido'
              ? 'Informe um celular válido com DDD, ex: (11) 99999-9999'
              : estado.erro}
          </p>
        )}
      </div>

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="notas">
            Observações{' '}
            <span className="font-normal text-gray-500 text-xs">(opcional)</span>
          </Label>
          <span className={cn(
            'text-xs tabular-nums',
            notas.length > NOTAS_MAX * 0.9 ? 'text-brand-warning' : 'text-gray-400'
          )}>
            {notas.length}/{NOTAS_MAX}
          </span>
        </div>
        <Textarea
          id="notas"
          name="notas"
          placeholder="Algo que queira nos informar antes do atendimento..."
          rows={3}
          maxLength={NOTAS_MAX}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      <SubmitButton />

      <p className="text-center text-xs text-gray-400">
        Você receberá uma confirmação via WhatsApp
      </p>
    </form>
  )
}
