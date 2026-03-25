'use client'

import { useState, useTransition, useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { StatusBadge } from './StatusBadge'
import { AdminCard, AdminCardBody, AdminCardSub } from './AdminCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  atualizarStatusAgendamento,
  atribuirMedium,
  editarAgendamento,
  excluirAgendamento,
  type EstadoFormAgendamento,
} from '@/lib/actions/admin'
import { formatarData } from '@/lib/utils/date'
import { formatarTelefone as fmtPhone } from '@/lib/utils/phone'
import type { AgendamentoComCliente, AppointmentStatus, Medium } from '@/types/database'
import { Check, X, Loader2, Download, MessageCircle, Clock, Pencil, Trash2 } from 'lucide-react'

interface AppointmentTableProps {
  agendamentos: AgendamentoComCliente[]
  mediuns?: Medium[]
}

function MediumSelect({
  agendamentoId,
  mediumId,
  mediuns,
}: {
  agendamentoId: string
  mediumId: string | null
  mediuns: Medium[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    startTransition(async () => {
      await atribuirMedium(agendamentoId, e.target.value)
      router.refresh()
    })
  }

  return (
    <select
      value={mediumId ?? ''}
      onChange={handleChange}
      className="text-xs rounded border border-gray-200 px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-muted max-w-[140px]"
    >
      <option value="">— sem médium</option>
      {mediuns.filter((m) => m.ativo).map((m) => (
        <option key={m.id} value={m.id}>{m.nome}</option>
      ))}
    </select>
  )
}

function ExportarCSVButton({ agendamentos, mediuns = [] }: AppointmentTableProps) {
  const handleExport = () => {
    const headers = ['Data', 'Horário', 'Consulente', 'Telefone', 'Médium', 'Status']
    const rows = agendamentos.map((ag) => {
      const medium = mediuns.find((m) => m.id === ag.medium_id)?.nome ?? '—'
      return [
        ag.data_agendada,
        `${ag.hora_inicio}–${ag.hora_fim}`,
        ag.clientes.nome,
        ag.clientes.telefone,
        medium,
        ag.status,
      ]
    })
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agendamentos-${new Date().toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-1.5">
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </Button>
  )
}

function SubmitEditarButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending} className="bg-brand hover:bg-brand-hover">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
      Salvar
    </Button>
  )
}

function CardAgendamento({
  ag,
  mediuns,
  onStatusChange,
  atualizando,
}: {
  ag: AgendamentoComCliente
  mediuns: Medium[]
  onStatusChange: (id: string, status: AppointmentStatus) => void
  atualizando: string | null
}) {
  const router = useRouter()
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)
  const [editando, setEditando] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  const editarComId = editarAgendamento.bind(null, ag.id)
  const [estadoEditar, actionEditar] = useFormState(
    editarComId as (estado: EstadoFormAgendamento, formData: FormData) => Promise<EstadoFormAgendamento>,
    null
  )

  useEffect(() => {
    if (estadoEditar === null && editando) {
      setEditando(false)
      router.refresh()
    }
  }, [estadoEditar])

  const handleExcluir = async () => {
    const resultado = await excluirAgendamento(ag.id)
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
              <span className="font-semibold text-gray-900">{ag.clientes.nome}</span>
              <StatusBadge status={ag.status} />
            </div>
            <div className="mt-1.5 text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1.5 items-center">
              <span>{formatarData(ag.data_agendada)}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                {ag.hora_inicio.slice(0, 5)} — {ag.hora_fim.slice(0, 5)}
              </span>
              <span>{fmtPhone(ag.clientes.telefone)}</span>
              {mediuns.length > 0 && (
                <MediumSelect
                  agendamentoId={ag.id}
                  mediumId={ag.medium_id}
                  mediuns={mediuns}
                />
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {atualizando === ag.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <>
                <a
                  href={`https://wa.me/${ag.clientes.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir WhatsApp"
                >
                  <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </a>

                {/* Editar */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditando(!editando)}
                  title="Editar agendamento"
                  className="text-gray-500 hover:text-brand hover:bg-brand-light"
                >
                  {editando ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </Button>

                {ag.status === 'pendente' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => onStatusChange(ag.id, 'confirmado')}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Confirmar
                  </Button>
                )}

                {ag.status === 'confirmado' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStatusChange(ag.id, 'realizado')}
                  >
                    Realizado
                  </Button>
                )}

                {(ag.status === 'pendente' || ag.status === 'confirmado') && (
                  confirmandoCancelamento ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 whitespace-nowrap">Cancelar?</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          onStatusChange(ag.id, 'cancelado')
                          setConfirmandoCancelamento(false)
                        }}
                      >
                        Sim
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmandoCancelamento(false)}
                      >
                        Não
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmandoCancelamento(true)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                  )
                )}

                {/* Excluir */}
                {confirmandoExcluir ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 whitespace-nowrap">Excluir?</span>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white h-7 px-2 text-xs"
                      onClick={handleExcluir}
                    >
                      Sim
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => setConfirmandoExcluir(false)}
                    >
                      Não
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmandoExcluir(true)}
                    title="Excluir agendamento"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
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
          <p className="text-xs font-medium text-gray-600 uppercase mb-3">Editar agendamento</p>
          <form action={actionEditar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`data-${ag.id}`} className="text-xs">Data</Label>
                <Input
                  id={`data-${ag.id}`}
                  name="data_agendada"
                  type="date"
                  defaultValue={ag.data_agendada}
                  required
                  className="h-8 text-sm"
                />
                {estadoEditar?.campo === 'data_agendada' && (
                  <p className="text-xs text-red-500">{estadoEditar.erro}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`hi-${ag.id}`} className="text-xs">Hora início</Label>
                <Input
                  id={`hi-${ag.id}`}
                  name="hora_inicio"
                  type="time"
                  defaultValue={ag.hora_inicio.slice(0, 5)}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`hf-${ag.id}`} className="text-xs">Hora fim</Label>
                <Input
                  id={`hf-${ag.id}`}
                  name="hora_fim"
                  type="time"
                  defaultValue={ag.hora_fim.slice(0, 5)}
                  required
                  className="h-8 text-sm"
                />
                {estadoEditar?.campo === 'hora_fim' && (
                  <p className="text-xs text-red-500">{estadoEditar.erro}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`notas-${ag.id}`} className="text-xs">Notas internas</Label>
              <textarea
                id={`notas-${ag.id}`}
                name="notas"
                rows={2}
                defaultValue={ag.notas ?? ''}
                placeholder="Observações sobre o atendimento..."
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-muted resize-none"
              />
            </div>
            {estadoEditar?.erro && !estadoEditar.campo && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {estadoEditar.erro}
              </p>
            )}
            <div className="flex gap-2">
              <SubmitEditarButton />
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

export function AppointmentTable({ agendamentos, mediuns = [] }: AppointmentTableProps) {
  const router = useRouter()
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleStatus = (id: string, novoStatus: AppointmentStatus) => {
    setAtualizando(id)
    startTransition(async () => {
      await atualizarStatusAgendamento(id, novoStatus)
      setAtualizando(null)
      router.refresh()
    })
  }

  if (agendamentos.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <p className="text-3xl">🕯️</p>
        <p className="mt-2 text-gray-500">Nenhum agendamento encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportarCSVButton agendamentos={agendamentos} mediuns={mediuns} />
      </div>

      <div className="space-y-2">
        {agendamentos.map((ag) => (
          <CardAgendamento
            key={ag.id}
            ag={ag}
            mediuns={mediuns}
            onStatusChange={handleStatus}
            atualizando={atualizando}
          />
        ))}
      </div>
    </div>
  )
}
