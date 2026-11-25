'use client'

import { useActionState } from 'react'
import { FormSemReset, useFormPending } from '@/components/shared/FormSemReset'
import { salvarInfoCasa, type EstadoFormCasa } from '@/lib/actions/casa'
import type { InfoCasa } from '@/lib/queries/casa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminCard, AdminCardBody } from '@/components/admin/AdminCard'
import { cn } from '@/lib/utils/cn'
import { CheckCircle2, Loader2 } from 'lucide-react'

function BotaoSalvar() {
  const pending = useFormPending()
  return (
    <Button type="submit" disabled={pending} className="bg-brand hover:bg-brand-hover">
      {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      Salvar
    </Button>
  )
}

const classeTextarea =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface CampoProps {
  nome: string
  rotulo: string
  ajuda?: string
  valor: string | null
  estado: EstadoFormCasa
  linhas?: number
  tipo?: string
  placeholder?: string
  maxLength: number
}

function Campo({ nome, rotulo, ajuda, valor, estado, linhas, tipo, placeholder, maxLength }: CampoProps) {
  const comErro = estado?.campo === nome
  const idAjuda = ajuda ? `${nome}-ajuda` : undefined
  const idErro = comErro ? `${nome}-erro` : undefined
  const descricao = [idAjuda, idErro].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1">
      <Label htmlFor={nome}>{rotulo}</Label>
      {linhas ? (
        <textarea
          id={nome}
          name={nome}
          rows={linhas}
          defaultValue={valor ?? ''}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={comErro || undefined}
          aria-describedby={descricao}
          className={cn(classeTextarea, comErro && 'border-red-400')}
        />
      ) : (
        <Input
          id={nome}
          name={nome}
          type={tipo ?? 'text'}
          defaultValue={valor ?? ''}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={comErro || undefined}
          aria-describedby={descricao}
          className={cn(comErro && 'border-red-400')}
        />
      )}
      {ajuda && (
        <p id={idAjuda} className="text-xs text-gray-500">
          {ajuda}
        </p>
      )}
      {comErro && (
        <p id={idErro} className="text-xs text-red-600">
          {estado?.erro}
        </p>
      )}
    </div>
  )
}

export function CasaForm({ info }: { info: InfoCasa }) {
  const [estado, action] = useActionState(salvarInfoCasa, null)

  return (
    <AdminCard>
      <AdminCardBody>
        <FormSemReset action={action} className="space-y-5">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-800">Onde fica</legend>
            <Campo nome="endereco" rotulo="Endereço" valor={info.endereco} estado={estado} maxLength={300}
              placeholder="Rua, número, bairro, cidade" />
            <Campo nome="link_mapa" rotulo="Link do mapa" valor={info.linkMapa} estado={estado} maxLength={500}
              tipo="url" placeholder="https://maps.app.goo.gl/..."
              ajuda="No Google Maps, abra o endereço, toque em Compartilhar e copie o link." />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-800">Contato</legend>
            <Campo nome="email_contato" rotulo="E-mail de contato" valor={info.emailContato} estado={estado}
              maxLength={254} tipo="email" />
            <Campo nome="telefone_contato" rotulo="Telefone de contato" valor={info.telefoneContato} estado={estado}
              maxLength={30} tipo="tel" placeholder="(11) 99999-9999" />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-800">Para o consulente</legend>
            <Campo nome="orientacoes" rotulo="Orientações para o atendimento" valor={info.orientacoes} estado={estado}
              maxLength={2000} linhas={5}
              ajuda="Ex.: chegar 15 minutos antes, roupa clara, o que trazer, como funciona o atendimento." />
            <Campo nome="politica_cancelamento" rotulo="Cancelamentos e atrasos" valor={info.politicaCancelamento}
              estado={estado} maxLength={1000} linhas={3}
              ajuda="Ex.: cancele com antecedência pelo link do e-mail; atrasos acima de 15 minutos..." />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-800">Privacidade (LGPD)</legend>
            <Campo nome="responsavel_dados" rotulo="Responsável pelos dados" valor={info.responsavelDados} estado={estado}
              maxLength={200}
              ajuda="Nome (e CNPJ, se houver) de quem responde pelos dados dos consulentes. Aparece na página de Privacidade." />
          </fieldset>

          {estado?.erro && !estado.campo && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {estado.erro}
            </p>
          )}
          {estado?.ok && (
            <p role="status" className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Informações salvas.
            </p>
          )}

          <BotaoSalvar />
        </FormSemReset>
      </AdminCardBody>
    </AdminCard>
  )
}
