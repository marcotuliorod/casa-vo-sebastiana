'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  editarCliente,
  excluirCliente,
  type EstadoFormCliente,
} from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminCard, AdminCardBody, AdminCardSub } from '@/components/admin/AdminCard'
import { formatarTelefone } from '@/lib/utils/phone'
import { formatarData } from '@/lib/utils/date'
import { Users, Phone, Calendar, MessageCircle, Pencil, X, Trash2, Loader2 } from 'lucide-react'
import type { Cliente } from '@/types/database'

interface ClienteComContagem extends Cliente {
  total_agendamentos: number
  ultimo_agendamento: string | null
}

function SubmitSalvarButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending} className="bg-brand hover:bg-brand-hover">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
      Salvar
    </Button>
  )
}

function LinhaConsulente({ cliente }: { cliente: ClienteComContagem }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  const editarComId = editarCliente.bind(null, cliente.id)
  const [estadoEditar, actionEditar] = useFormState(
    editarComId as (estado: EstadoFormCliente, formData: FormData) => Promise<EstadoFormCliente>,
    null
  )

  useEffect(() => {
    if (estadoEditar === null && editando) {
      setEditando(false)
      router.refresh()
    }
  }, [estadoEditar])

  const handleExcluir = async () => {
    const resultado = await excluirCliente(cliente.id)
    if (resultado.erro) {
      setErroExcluir(resultado.erro)
      setConfirmandoExcluir(false)
    } else {
      router.refresh()
    }
  }

  return (
    <AdminCard>
      <AdminCardBody>
        <div className="flex items-start justify-between gap-3">
          {/* Informações */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{cliente.nome}</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-600">
                {cliente.total_agendamentos} atend.
              </span>
            </div>
            <div className="mt-1.5 text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                {formatarTelefone(cliente.telefone)}
              </span>
              {cliente.ultimo_agendamento && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  Último: {formatarData(cliente.ultimo_agendamento)}
                </span>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={`https://wa.me/${cliente.telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir WhatsApp"
              className="flex items-center justify-center h-8 w-8 rounded-md text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
            </a>

            {/* Editar */}
            <button
              onClick={() => setEditando(!editando)}
              title="Editar consulente"
              className="flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-brand hover:bg-brand-light transition-colors"
            >
              {editando ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>

            {/* Excluir */}
            {confirmandoExcluir ? (
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-gray-500 whitespace-nowrap">Excluir?</span>
                <button
                  onClick={handleExcluir}
                  className="text-xs font-medium text-red-600 hover:text-red-800 px-1"
                >
                  Sim
                </button>
                <button
                  onClick={() => setConfirmandoExcluir(false)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 px-1"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmandoExcluir(true)}
                title="Excluir consulente"
                className="flex items-center justify-center h-8 w-8 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {erroExcluir && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {erroExcluir}
          </p>
        )}
      </AdminCardBody>

      {/* Formulário de edição inline */}
      {editando && (
        <AdminCardSub>
          <p className="text-xs font-medium text-gray-600 uppercase mb-3">Editar consulente</p>
          <form action={actionEditar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`nome-${cliente.id}`} className="text-xs">Nome *</Label>
                <Input
                  id={`nome-${cliente.id}`}
                  name="nome"
                  defaultValue={cliente.nome}
                  required
                  className="h-8 text-sm"
                />
                {estadoEditar?.campo === 'nome' && (
                  <p className="text-xs text-red-500">{estadoEditar.erro}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`tel-${cliente.id}`} className="text-xs">Telefone *</Label>
                <Input
                  id={`tel-${cliente.id}`}
                  name="telefone"
                  type="tel"
                  defaultValue={cliente.telefone}
                  required
                  className="h-8 text-sm"
                />
                {estadoEditar?.campo === 'telefone' && (
                  <p className="text-xs text-red-500">{estadoEditar.erro}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`email-${cliente.id}`} className="text-xs">
                  Email <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id={`email-${cliente.id}`}
                  name="email"
                  type="email"
                  defaultValue={cliente.email ?? ''}
                  className="h-8 text-sm"
                />
                {estadoEditar?.campo === 'email' && (
                  <p className="text-xs text-red-500">{estadoEditar.erro}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`notas-${cliente.id}`} className="text-xs">
                  Notas <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id={`notas-${cliente.id}`}
                  name="notas"
                  defaultValue={cliente.notas ?? ''}
                  placeholder="Observações sobre o consulente"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            {estadoEditar?.erro && !estadoEditar.campo && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {estadoEditar.erro}
              </p>
            )}
            <div className="flex gap-2">
              <SubmitSalvarButton />
              <Button type="button" variant="outline" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </AdminCardSub>
      )}
    </AdminCard>
  )
}

interface ConsulentesManagerProps {
  clientes: ClienteComContagem[]
}

export function ConsulentesManager({ clientes }: ConsulentesManagerProps) {
  if (clientes.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-400">Nenhum consulente ainda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {clientes.map((c) => (
        <LinhaConsulente key={c.id} cliente={c} />
      ))}
    </div>
  )
}
