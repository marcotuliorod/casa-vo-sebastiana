'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  criarMedium,
  toggleMediumAtivo,
  editarMedium,
  excluirMedium,
  type EstadoFormMedium,
} from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'
import { AdminCardSub } from '@/components/admin/AdminCard'
import { Link2, Loader2, UserCheck, UserX, Sparkles, Pencil, X, Trash2 } from 'lucide-react'
import type { Medium } from '@/types/database'

interface MediunsManagerProps {
  mediuns: Medium[]
}

function SubmitButton({ label = 'Cadastrar médium' }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="bg-brand hover:bg-brand-hover">
      {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      {label}
    </Button>
  )
}

function CopiarLink({ token }: { token: string }) {
  const handleCopy = () => {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin
    navigator.clipboard.writeText(`${base}/mediuns/${token}`)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar link de acesso"
      className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dark hover:underline"
    >
      <Link2 className="h-3.5 w-3.5" />
      Copiar link
    </button>
  )
}

function LinhaMedium({ medium }: { medium: Medium }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  const editarComId = editarMedium.bind(null, medium.id)
  const [estadoEditar, actionEditar] = useFormState(
    editarComId as (estado: EstadoFormMedium, formData: FormData) => Promise<EstadoFormMedium>,
    null
  )

  useEffect(() => {
    if (estadoEditar === null && editando) {
      setEditando(false)
      router.refresh()
    }
  }, [estadoEditar])

  const handleToggle = () => {
    startTransition(async () => {
      await toggleMediumAtivo(medium.id, !medium.ativo)
      router.refresh()
    })
  }

  const handleExcluir = async () => {
    const resultado = await excluirMedium(medium.id)
    if (resultado.erro) {
      setErroExcluir(resultado.erro)
      setConfirmandoExcluir(false)
    } else {
      router.refresh()
    }
  }

  return (
    <div className={cn('border-b last:border-b-0', !medium.ativo && 'opacity-60')}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Informações */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{medium.nome}</span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  medium.ativo
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                )}
              >
                {medium.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="mt-1.5 text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
              {medium.especialidade && (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                  {medium.especialidade}
                </span>
              )}
              {medium.telefone && <span>{medium.telefone}</span>}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {medium.ativo && <CopiarLink token={medium.token_acesso} />}

            {/* Editar */}
            <button
              onClick={() => setEditando(!editando)}
              title="Editar médium"
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand"
            >
              {editando ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editando ? 'Fechar' : 'Editar'}
            </button>

            {/* Toggle ativo */}
            <button
              onClick={handleToggle}
              title={medium.ativo ? 'Desativar médium' : 'Reativar médium'}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium',
                medium.ativo
                  ? 'text-red-500 hover:text-red-700'
                  : 'text-green-600 hover:text-green-800'
              )}
            >
              {medium.ativo ? (
                <>
                  <UserX className="h-3.5 w-3.5" />
                  Desativar
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  Reativar
                </>
              )}
            </button>

            {/* Excluir */}
            {confirmandoExcluir ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Excluir?</span>
                <button
                  onClick={handleExcluir}
                  className="text-xs font-medium text-red-600 hover:text-red-800"
                >
                  Sim
                </button>
                <button
                  onClick={() => setConfirmandoExcluir(false)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmandoExcluir(true)}
                title="Excluir médium"
                className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            )}
          </div>
        </div>

        {erroExcluir && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {erroExcluir}
          </p>
        )}
      </div>

      {/* Formulário de edição inline */}
      {editando && (
        <AdminCardSub>
          <p className="text-xs font-medium text-gray-600 uppercase mb-3">Editar médium</p>
          <form action={actionEditar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`nome-${medium.id}`} className="text-xs">Nome *</Label>
                <Input
                  id={`nome-${medium.id}`}
                  name="nome"
                  defaultValue={medium.nome}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`esp-${medium.id}`} className="text-xs">
                  Especialidade <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id={`esp-${medium.id}`}
                  name="especialidade"
                  defaultValue={medium.especialidade ?? ''}
                  placeholder="Ex: Umbanda, Passe"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`tel-${medium.id}`} className="text-xs">
                  Telefone <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id={`tel-${medium.id}`}
                  name="telefone"
                  type="tel"
                  defaultValue={medium.telefone ?? ''}
                  placeholder="(11) 99999-9999"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            {estadoEditar?.erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {estadoEditar.erro}
              </p>
            )}
            <div className="flex gap-2">
              <SubmitButton label="Salvar" />
              <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </AdminCardSub>
      )}
    </div>
  )
}

export function MediunsManager({ mediuns }: MediunsManagerProps) {
  const router = useRouter()
  const [estado, action] = useFormState(criarMedium, null)

  useEffect(() => {
    if (estado && !estado.erro) {
      router.refresh()
    }
  }, [estado])

  return (
    <div className="space-y-6">
      {/* Formulário de cadastro */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Adicionar médium</h2>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" name="nome" placeholder="Ex: Mãe Joana" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="especialidade">
                Especialidade{' '}
                <span className="font-normal text-gray-400 text-xs">(opcional)</span>
              </Label>
              <Input
                id="especialidade"
                name="especialidade"
                placeholder="Ex: Umbanda, Passe, Cura"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">
                Telefone{' '}
                <span className="font-normal text-gray-400 text-xs">(opcional)</span>
              </Label>
              <Input id="telefone" name="telefone" type="tel" placeholder="(11) 99999-9999" />
            </div>
          </div>

          {estado?.erro && (
            <p className="text-sm text-red-600">{estado.erro}</p>
          )}

          <SubmitButton />
        </form>
      </div>

      {/* Lista de médiuns */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h2 className="text-base font-semibold text-gray-800">
            Médiuns cadastrados{' '}
            <span className="text-sm font-normal text-gray-500">({mediuns.length})</span>
          </h2>
        </div>

        {mediuns.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Nenhum médium cadastrado ainda.
          </div>
        ) : (
          <div>
            {mediuns.map((m) => (
              <LinhaMedium key={m.id} medium={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
