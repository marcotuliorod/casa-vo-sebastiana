'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { inscreverEmEvento, type EstadoFormAgendamento } from '@/lib/actions/booking'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { OcorrenciaEvento } from '@/types/database'

interface EventoInscricaoFormProps {
  eventoId: string
  tituloEvento: string
  horaInicio: string
  horaFim: string
  ocorrencias: OcorrenciaEvento[]
}

function BotaoSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Registrando inscrição...' : 'Confirmar inscrição'}
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
  const [estado, action] = useFormState(
    inscreverEmEvento as (estado: EstadoFormAgendamento, formData: FormData) => Promise<EstadoFormAgendamento>,
    null
  )

  const ocorrenciasDisponiveis = ocorrencias.filter((o) => o.vagasRestantes > 0)

  if (ocorrencias.length === 0) {
    return (
      <p className="text-center text-gray-500 py-6">
        Não há datas disponíveis para este evento.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="evento_id" value={eventoId} />

      {/* Seleção de data */}
      <div className="space-y-2">
        <Label htmlFor="data">Escolha a data *</Label>
        <div className="space-y-2">
          {ocorrencias.map((oc) => {
            const esgotado = oc.vagasRestantes === 0
            const dataFormatada = format(parseISO(oc.data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })

            return (
              <label
                key={oc.data}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  esgotado
                    ? 'opacity-50 cursor-not-allowed bg-gray-50'
                    : 'hover:bg-purple-50 hover:border-purple-300'
                }`}
              >
                <input
                  type="radio"
                  name="data"
                  value={oc.data}
                  disabled={esgotado}
                  required
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 capitalize">
                    {dataFormatada}
                  </p>
                  <p className="text-xs text-gray-500">
                    {horaInicio.slice(0, 5)} — {horaFim.slice(0, 5)}
                    {' · '}
                    {esgotado ? (
                      <span className="text-red-500">Esgotado</span>
                    ) : (
                      <span className="text-green-600">
                        {oc.vagasRestantes} vaga{oc.vagasRestantes !== 1 ? 's' : ''} disponível
                      </span>
                    )}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
        {ocorrenciasDisponiveis.length === 0 && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            Todas as datas disponíveis estão esgotadas.
          </p>
        )}
      </div>

      {/* Dados pessoais */}
      <div className="space-y-1">
        <Label htmlFor="nome">Nome completo *</Label>
        <Input
          id="nome"
          name="nome"
          placeholder="Seu nome"
          autoComplete="name"
          required
        />
        {estado?.campo === 'nome' && (
          <p className="text-xs text-red-500">{estado.erro}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="telefone">WhatsApp *</Label>
        <Input
          id="telefone"
          name="telefone"
          placeholder="(11) 99999-9999"
          type="tel"
          autoComplete="tel"
          required
        />
        <p className="text-xs text-gray-400">
          Você receberá a confirmação por WhatsApp
        </p>
        {estado?.campo === 'telefone' && (
          <p className="text-xs text-red-500">{estado.erro}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">
          E-mail
          <span className="text-gray-400 font-normal"> (opcional)</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="notas">
          Observações
          <span className="text-gray-400 font-normal"> (opcional)</span>
        </Label>
        <textarea
          id="notas"
          name="notas"
          rows={2}
          maxLength={500}
          placeholder="Alguma informação adicional..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </div>

      {/* Erro geral */}
      {estado?.erro && !estado.campo && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {estado.erro}
        </p>
      )}

      {ocorrenciasDisponiveis.length > 0 && <BotaoSubmit />}
    </form>
  )
}
