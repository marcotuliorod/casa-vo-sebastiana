'use client'

import { useActionState, useState } from 'react'
import { CampoIsca } from '@/components/shared/CampoIsca'
import { ConsentimentoDados } from '@/components/booking/ConsentimentoDados'
import { usePhoneMask } from '@/components/booking/usePhoneMask'
import { FormSemReset, useFormPending } from '@/components/shared/FormSemReset'
import { inscreverEmEvento, type EstadoFormAgendamento } from '@/lib/actions/booking'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { formatarDataExtensoTitulo } from '@/lib/utils/date'
import type { OcorrenciaEvento } from '@/types/database'

interface EventoInscricaoFormProps {
  eventoId: string
  tituloEvento: string
  horaInicio: string
  horaFim: string
  ocorrencias: OcorrenciaEvento[]
}

function BotaoSubmit() {
  const pending = useFormPending()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full bg-brand hover:bg-brand-hover">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Registrando inscrição...
        </>
      ) : (
        '✨ Confirmar inscrição'
      )}
    </Button>
  )
}

export function EventoInscricaoForm({
  eventoId,
  tituloEvento,
  horaInicio,
  horaFim,
  ocorrencias,
}: EventoInscricaoFormProps) {
  const [estado, action] = useActionState(
    inscreverEmEvento as (estado: EstadoFormAgendamento, formData: FormData) => Promise<EstadoFormAgendamento>,
    null
  )

  const ocorrenciasDisponiveis = ocorrencias.filter((o) => o.vagasRestantes > 0)
  const [telefone, handleTelefoneInput] = usePhoneMask()
  // Eventos semanais podem ter dezenas de datas: mostra as primeiras e o resto sob demanda
  const [todasAsDatas, setTodasAsDatas] = useState(false)
  const DATAS_VISIVEIS = 8
  const ocorrenciasVisiveis = todasAsDatas ? ocorrencias : ocorrencias.slice(0, DATAS_VISIVEIS)

  const CAMPOS_COM_ERRO = ['nome', 'telefone', 'email', 'consentimento', 'data']
  const erroGeral = estado?.erro && !CAMPOS_COM_ERRO.includes(estado.campo ?? '') ? estado.erro : null
  const erroDo = (campo: string) => (estado?.campo === campo ? estado.erro : undefined)
  const acessivel = (campo: string) =>
    erroDo(campo) ? { 'aria-invalid': true as const, 'aria-describedby': `${campo}-erro` } : {}

  if (ocorrencias.length === 0) {
    return (
      <p className="text-center text-gray-500 py-6">
        Não há datas disponíveis para este evento.
      </p>
    )
  }

  return (
    <FormSemReset action={action} className="space-y-5">
      <input type="hidden" name="evento_id" value={eventoId} />
      <CampoIsca />

      {/* Seleção de data */}
      <fieldset className="space-y-2" {...acessivel('data')}>
        <legend className="text-sm font-medium leading-none mb-2">Escolha a data *</legend>
        <div className="space-y-2">
          {ocorrenciasVisiveis.map((oc) => {
            const esgotado = oc.vagasRestantes === 0
            const dataFormatada = formatarDataExtensoTitulo(oc.data)

            return (
              <label
                key={oc.data}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  esgotado
                    ? 'opacity-50 cursor-not-allowed bg-gray-50'
                    : 'hover:bg-brand-light hover:border-brand-muted'
                }`}
              >
                <input
                  type="radio"
                  name="data"
                  value={oc.data}
                  disabled={esgotado}
                  required
                  className="mt-0.5 h-5 w-5 flex-shrink-0 accent-brand"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {dataFormatada}
                  </p>
                  <p className="text-xs text-gray-500">
                    {horaInicio.slice(0, 5)} — {horaFim.slice(0, 5)}
                    {' · '}
                    {esgotado ? (
                      <span className="text-brand-error">Esgotado</span>
                    ) : (
                      <span className="text-brand-success">
                        {oc.vagasRestantes === 1 ? '1 vaga disponível' : `${oc.vagasRestantes} vagas disponíveis`}
                      </span>
                    )}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
        {!todasAsDatas && ocorrencias.length > DATAS_VISIVEIS && (
          <button
            type="button"
            onClick={() => setTodasAsDatas(true)}
            className="w-full py-3 text-sm font-medium text-brand-dark underline underline-offset-2"
          >
            Mostrar mais {ocorrencias.length - DATAS_VISIVEIS} datas
          </button>
        )}
        {erroDo('data') && (
          <p id="data-erro" role="alert" className="text-xs text-brand-error">{erroDo('data')}</p>
        )}
        {ocorrenciasDisponiveis.length === 0 && (
          <p className="text-sm text-brand-error bg-brand-error/10 border border-brand-error/30 rounded-lg px-3 py-2">
            Todas as datas disponíveis estão esgotadas.
          </p>
        )}
      </fieldset>

      {/* Dados pessoais */}
      <div className="space-y-1">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input
          id="nome"
          name="nome"
          placeholder="Seu nome"
          autoComplete="name"
          maxLength={120}
          required
          {...acessivel('nome')}
        />
        {erroDo('nome') && (
          <p id="nome-erro" role="alert" className="text-xs text-brand-error">{erroDo('nome')}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="telefone">
          Telefone * <span className="font-normal text-gray-500 text-xs">(celular com DDD)</span>
        </Label>
        <Input
          id="telefone"
          name="telefone"
          placeholder="(11) 99999-9999"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={15}
          value={telefone}
          onInput={handleTelefoneInput}
          required
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

      <div className="space-y-1">
        <Label htmlFor="email">E-mail *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          inputMode="email"
          autoComplete="email"
          required
          {...acessivel('email')}
        />
        <p className="text-xs text-gray-500">Você receberá a confirmação por e-mail.</p>
        {erroDo('email') && (
          <p id="email-erro" role="alert" className="text-xs text-brand-error">{erroDo('email')}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="notas">
          Observações
          <span className="text-gray-500 font-normal"> (opcional)</span>
        </Label>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          maxLength={500}
          placeholder="Alguma informação adicional..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-brand-muted resize-none"
        />
      </div>

      {/* Erro geral */}
      {erroGeral && (
        <p role="alert" className="text-sm text-brand-error bg-brand-error/10 border border-brand-error/30 rounded-xl px-3 py-2">
          {erroGeral}
        </p>
      )}

      {ocorrenciasDisponiveis.length > 0 && (
        <>
          <ConsentimentoDados erro={erroDo('consentimento')} />
          <BotaoSubmit />
        </>
      )}
    </FormSemReset>
  )
}
