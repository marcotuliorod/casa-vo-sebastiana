'use client'

import { useActionState, useState } from 'react'
import { CampoIsca } from '@/components/shared/CampoIsca'
import { ConsentimentoDados } from '@/components/booking/ConsentimentoDados'
import { usePhoneMask } from '@/components/booking/usePhoneMask'
import { FormSemReset, useFormPending } from '@/components/shared/FormSemReset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { criarAgendamento, type EstadoFormAgendamento } from '@/lib/actions/booking'
import { formatarDataExtensoTitulo } from '@/lib/utils/date'
import { cn } from '@/lib/utils/cn'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface BookingFormProps {
  data: string
  horaInicio: string
  horaFim: string
}


function AppointmentSummary({ data, horaInicio, horaFim }: BookingFormProps) {
  return (
    <div className="rounded-xl bg-brand-areia/40 p-4 text-center border border-brand-muted/30">
      <p className="text-sm text-brand font-medium">Você está agendando para:</p>
      <p className="text-lg font-bold text-brand-dark">{formatarDataExtensoTitulo(data)}</p>
      <p className="text-brand">
        {horaInicio} — {horaFim}
      </p>
    </div>
  )
}

function SubmitButton() {
  const pending = useFormPending()
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
  const [estado, action] = useActionState<EstadoFormAgendamento, FormData>(
    criarAgendamento,
    null
  )
  const [nome, setNome] = useState('')
  const [telefone, handleTelefoneInput] = usePhoneMask()
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const NOTAS_MAX = 500

  // Campos que mostram o próprio erro; os demais (data, horário) vão para a caixa geral
  const CAMPOS_COM_ERRO = ['nome', 'telefone', 'email', 'notas', 'consentimento']
  const erroGeral = estado?.erro && !CAMPOS_COM_ERRO.includes(estado.campo ?? '') ? estado.erro : null
  const erroDo = (campo: string) => (estado?.campo === campo ? estado.erro : undefined)
  const acessivel = (campo: string) =>
    erroDo(campo) ? { 'aria-invalid': true as const, 'aria-describedby': `${campo}-erro` } : {}

  return (
    <FormSemReset action={action} className="space-y-5">
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="hora_inicio" value={horaInicio} />
      <input type="hidden" name="hora_fim" value={horaFim} />
      <CampoIsca />

      <AppointmentSummary data={data} horaInicio={horaInicio} horaFim={horaFim} />

      {erroGeral && (
        <div role="alert" className="rounded-lg bg-brand-error/10 border border-brand-error/30 p-3 text-sm text-brand-error space-y-2">
          <p>{erroGeral}</p>
          {(erroGeral.includes('horário') || erroGeral.includes('data')) && (
            <Link
              href={`/agendar/${data}`}
              className="inline-flex items-center py-1 text-sm font-medium text-brand-error underline hover:opacity-80"
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
          maxLength={120}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={cn(erroDo('nome') && 'border-brand-error')}
          {...acessivel('nome')}
        />
        {erroDo('nome') && (
          <p id="nome-erro" role="alert" className="text-xs text-brand-error">{erroDo('nome')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="telefone">
          Telefone *{' '}
          <span className="font-normal text-gray-500 text-xs">(celular com DDD)</span>
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
          inputMode="tel"
          onInput={handleTelefoneInput}
          className={cn(erroDo('telefone') && 'border-brand-error')}
          {...acessivel('telefone')}
        />
        {erroDo('telefone') && (
          <p id="telefone-erro" role="alert" className="text-xs text-brand-error">
            {erroDo('telefone') === 'Telefone inválido'
              ? 'Informe um celular válido com DDD, ex: (11) 99999-9999'
              : erroDo('telefone')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">
          E-mail *{' '}
          <span className="font-normal text-gray-500 text-xs">(para confirmação)</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(erroDo('email') && 'border-brand-error')}
          {...acessivel('email')}
        />
        {erroDo('email') && (
          <p id="email-erro" role="alert" className="text-xs text-brand-error">{erroDo('email')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="notas">
            Observações{' '}
            <span className="font-normal text-gray-500 text-xs">(opcional)</span>
          </Label>
          <span className={cn(
            'text-xs tabular-nums',
            notas.length > NOTAS_MAX * 0.9 ? 'text-brand-warning' : 'text-gray-500'
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
          {...acessivel('notas')}
        />
        {erroDo('notas') && (
          <p id="notas-erro" role="alert" className="text-xs text-brand-error">{erroDo('notas')}</p>
        )}
      </div>

      <ConsentimentoDados erro={erroDo('consentimento')} />

      <SubmitButton />

      <p className="text-center text-xs text-gray-500">Você receberá a confirmação por e-mail.</p>
    </FormSemReset>
  )
}
