'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  criarRecado,
  editarRecado,
  excluirRecado,
  toggleFixadoRecado,
  type EstadoFormRecado,
} from '@/lib/actions/recados'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'
import { AdminCardSub } from '@/components/admin/AdminCard'
import { Loader2, Pin, PinOff, Pencil, X, Trash2, MessageSquare, Plus } from 'lucide-react'
import type { Recado, PrioridadeRecado } from '@/types/database'
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="bg-brand hover:bg-brand-hover">
      {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      {label}
    </Button>
  )
}

const PRIORIDADE_CONFIG: Record<PrioridadeRecado, { label: string; cor: string; fundo: string; borda: string }> = {
  normal:     { label: 'Normal',     cor: 'text-gray-500',   fundo: '',            borda: '' },
  importante: { label: 'Importante', cor: 'text-amber-700',  fundo: 'bg-amber-50', borda: 'border-l-4 border-amber-400' },
  urgente:    { label: 'Urgente',    cor: 'text-red-700',    fundo: 'bg-red-50',   borda: 'border-l-4 border-red-500' },
}

function FormRecado({
  recado,
  actionFn,
  estado,
  onCancelar,
  labelSubmit,
}: {
  recado?: Recado
  actionFn: (formData: FormData) => void
  estado: EstadoFormRecado
  onCancelar: () => void
  labelSubmit: string
}) {
  return (
    <form action={actionFn} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={recado ? `titulo-${recado.id}` : 'titulo-novo'} className="text-xs">
          Título *
        </Label>
        <Input
          id={recado ? `titulo-${recado.id}` : 'titulo-novo'}
          name="titulo"
          defaultValue={recado?.titulo ?? ''}
          required
          className={cn('h-8 text-sm', estado?.campo === 'titulo' && 'border-red-400')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={recado ? `conteudo-${recado.id}` : 'conteudo-novo'} className="text-xs">
          Conteúdo *
        </Label>
        <textarea
          id={recado ? `conteudo-${recado.id}` : 'conteudo-novo'}
          name="conteudo"
          defaultValue={recado?.conteudo ?? ''}
          required
          rows={4}
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            estado?.campo === 'conteudo' && 'border-red-400'
          )}
        />
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label htmlFor={recado ? `prioridade-${recado.id}` : 'prioridade-novo'} className="text-xs">
            Prioridade
          </Label>
          <select
            id={recado ? `prioridade-${recado.id}` : 'prioridade-novo'}
            name="prioridade"
            defaultValue={recado?.prioridade ?? 'normal'}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="normal">Normal</option>
            <option value="importante">Importante</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="fixado"
            defaultChecked={recado?.fixado ?? false}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Fixar recado</span>
        </label>
      </div>

      {estado?.erro && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {estado.erro}
        </p>
      )}

      <div className="flex gap-2">
        <SubmitButton label={labelSubmit} />
        <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function LinhaRecado({ recado }: { recado: Recado }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  const editarComId = editarRecado.bind(null, recado.id)
  const [estadoEditar, actionEditar] = useFormState(
    editarComId as (estado: EstadoFormRecado, formData: FormData) => Promise<EstadoFormRecado>,
    null
  )

  useEffect(() => {
    if (estadoEditar === null && editando) {
      setEditando(false)
      router.refresh()
    }
  }, [estadoEditar])

  const handleToggleFixado = () => {
    startTransition(async () => {
      await toggleFixadoRecado(recado.id, !recado.fixado)
      router.refresh()
    })
  }

  const handleExcluir = async () => {
    const resultado = await excluirRecado(recado.id)
    if (resultado.erro) {
      setErroExcluir(resultado.erro)
      setConfirmandoExcluir(false)
    } else {
      router.refresh()
    }
  }

  const cfg = PRIORIDADE_CONFIG[recado.prioridade]
  const ehNovo = differenceInDays(new Date(), parseISO(recado.criado_em)) <= 3
  const dataRelativa = formatDistanceToNow(parseISO(recado.criado_em), { locale: ptBR, addSuffix: true })

  return (
    <div className={cn('border-b last:border-b-0', cfg.borda)}>
      <div className={cn('p-4', cfg.fundo)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {recado.fixado && <Pin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
              <span className="font-semibold text-gray-900 text-sm">{recado.titulo}</span>
              {recado.prioridade !== 'normal' && (
                <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.cor)}>
                  {cfg.label}
                </span>
              )}
              {ehNovo && (
                <span className="inline-flex items-center rounded-full bg-brand-light text-brand text-xs font-medium px-2 py-0.5">
                  Novo
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">{recado.conteudo}</p>
            <p className="text-xs text-gray-400">{dataRelativa}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {/* Fixar/Desafixar */}
            <button
              onClick={handleToggleFixado}
              title={recado.fixado ? 'Desafixar' : 'Fixar recado'}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand"
            >
              {recado.fixado ? (
                <><PinOff className="h-3.5 w-3.5" /> Desafixar</>
              ) : (
                <><Pin className="h-3.5 w-3.5" /> Fixar</>
              )}
            </button>

            {/* Editar */}
            <button
              onClick={() => setEditando(!editando)}
              title="Editar recado"
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand"
            >
              {editando ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editando ? 'Fechar' : 'Editar'}
            </button>

            {/* Excluir */}
            {confirmandoExcluir ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Excluir?</span>
                <button onClick={handleExcluir} className="text-xs font-medium text-red-600 hover:text-red-800">Sim</button>
                <button onClick={() => setConfirmandoExcluir(false)} className="text-xs font-medium text-gray-500 hover:text-gray-700">Não</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmandoExcluir(true)}
                title="Excluir recado"
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

      {editando && (
        <AdminCardSub>
          <p className="text-xs font-medium text-gray-600 uppercase mb-3">Editar recado</p>
          <FormRecado
            recado={recado}
            actionFn={actionEditar}
            estado={estadoEditar}
            onCancelar={() => setEditando(false)}
            labelSubmit="Salvar"
          />
        </AdminCardSub>
      )}
    </div>
  )
}

export function RecadosManager({ recados }: { recados: Recado[] }) {
  const router = useRouter()
  const [criando, setCriando] = useState(false)
  const [estadoCriar, actionCriar] = useFormState(criarRecado, null)

  useEffect(() => {
    if (estadoCriar === null && criando) {
      setCriando(false)
      router.refresh()
    }
  }, [estadoCriar])

  return (
    <div className="space-y-5">
      {/* Botão / formulário de criação */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            Recados ativos{' '}
            <span className="text-sm font-normal text-gray-500">({recados.length})</span>
          </h2>
          <button
            onClick={() => setCriando(!criando)}
            className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
          >
            {criando ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {criando ? 'Cancelar' : 'Novo recado'}
          </button>
        </div>

        {criando && (
          <AdminCardSub>
            <p className="text-xs font-medium text-gray-600 uppercase mb-3">Novo recado</p>
            <FormRecado
              actionFn={actionCriar}
              estado={estadoCriar}
              onCancelar={() => setCriando(false)}
              labelSubmit="Criar recado"
            />
          </AdminCardSub>
        )}

        {recados.length === 0 && !criando ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <MessageSquare className="h-8 w-8 mx-auto opacity-30" />
            <p className="text-sm">Nenhum recado criado ainda.</p>
          </div>
        ) : (
          <div>
            {recados.map((r) => (
              <LinhaRecado key={r.id} recado={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
