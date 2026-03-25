'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  criarEvento,
  editarEvento,
  toggleEventoAtivo,
  excluirEvento,
  type EstadoFormEvento,
} from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarRange, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { OcorrenciaEvento, Evento, RecorrenciaTipo } from '@/types/database'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type EventoComOcorrencias = Evento & { ocorrencias: OcorrenciaEvento[] }

const ROTULOS_RECORRENCIA: Record<RecorrenciaTipo, string> = {
  nenhuma: 'Sem recorrência',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
}

function formatarData(data: string) {
  try {
    return format(parseISO(data), "dd/MM/yyyy", { locale: ptBR })
  } catch {
    return data
  }
}

function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

// ─── Botão de submit com loading ─────────────────────────────

function BotaoSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Salvando...' : label}
    </Button>
  )
}

// ─── Formulário de criação/edição ────────────────────────────

function FormEvento({
  action,
  estado,
  inicial,
  onCancelar,
  labelSubmit,
}: {
  action: (formData: FormData) => void
  estado: EstadoFormEvento
  inicial?: Partial<Evento>
  onCancelar?: () => void
  labelSubmit: string
}) {
  const [recorrencia, setRecorrencia] = useState<RecorrenciaTipo>(
    inicial?.recorrencia ?? 'nenhuma'
  )

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Título */}
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="titulo">Título *</Label>
          <Input
            id="titulo"
            name="titulo"
            placeholder="Ex: Gira de Umbanda"
            defaultValue={inicial?.titulo ?? ''}
            required
          />
          {estado?.campo === 'titulo' && (
            <p className="text-xs text-red-500">{estado.erro}</p>
          )}
        </div>

        {/* Descrição */}
        <div className="sm:col-span-2 space-y-1">
          <Label htmlFor="descricao">Descrição</Label>
          <textarea
            id="descricao"
            name="descricao"
            rows={2}
            placeholder="Informações sobre o evento..."
            defaultValue={inicial?.descricao ?? ''}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-muted resize-none"
          />
        </div>

        {/* Data de início */}
        <div className="space-y-1">
          <Label htmlFor="data_inicio">Data de início *</Label>
          <Input
            id="data_inicio"
            name="data_inicio"
            type="date"
            defaultValue={inicial?.data_inicio ?? ''}
            required
          />
        </div>

        {/* Capacidade */}
        <div className="space-y-1">
          <Label htmlFor="capacidade">Capacidade (vagas) *</Label>
          <Input
            id="capacidade"
            name="capacidade"
            type="number"
            min={1}
            max={500}
            defaultValue={inicial?.capacidade ?? 10}
            required
          />
          {estado?.campo === 'capacidade' && (
            <p className="text-xs text-red-500">{estado.erro}</p>
          )}
        </div>

        {/* Hora início */}
        <div className="space-y-1">
          <Label htmlFor="hora_inicio">Hora de início *</Label>
          <Input
            id="hora_inicio"
            name="hora_inicio"
            type="time"
            defaultValue={inicial?.hora_inicio?.slice(0, 5) ?? ''}
            required
          />
        </div>

        {/* Hora fim */}
        <div className="space-y-1">
          <Label htmlFor="hora_fim">Hora de fim *</Label>
          <Input
            id="hora_fim"
            name="hora_fim"
            type="time"
            defaultValue={inicial?.hora_fim?.slice(0, 5) ?? ''}
            required
          />
          {estado?.campo === 'hora_fim' && (
            <p className="text-xs text-red-500">{estado.erro}</p>
          )}
        </div>

        {/* Recorrência */}
        <div className="space-y-1">
          <Label htmlFor="recorrencia">Recorrência</Label>
          <select
            id="recorrencia"
            name="recorrencia"
            value={recorrencia}
            onChange={(e) => setRecorrencia(e.target.value as RecorrenciaTipo)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-muted"
          >
            <option value="nenhuma">Sem recorrência (evento único)</option>
            <option value="semanal">Semanal</option>
            <option value="quinzenal">Quinzenal</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>

        {/* Data fim recorrência — só aparece se recorrência ativa */}
        {recorrencia !== 'nenhuma' && (
          <div className="space-y-1">
            <Label htmlFor="data_fim_recorrencia">
              Encerrar recorrência em
              <span className="text-gray-400 font-normal"> (opcional)</span>
            </Label>
            <Input
              id="data_fim_recorrencia"
              name="data_fim_recorrencia"
              type="date"
              defaultValue={inicial?.data_fim_recorrencia ?? ''}
            />
          </div>
        )}
        {recorrencia === 'nenhuma' && (
          <input type="hidden" name="data_fim_recorrencia" value="" />
        )}

        {/* Lembrete */}
        <div className="space-y-1">
          <Label htmlFor="lembrete_horas">Lembrete (horas antes) *</Label>
          <Input
            id="lembrete_horas"
            name="lembrete_horas"
            type="number"
            min={1}
            max={168}
            defaultValue={inicial?.lembrete_horas ?? 24}
            required
          />
          <p className="text-xs text-gray-400">
            Quanto tempo antes enviar o lembrete aos inscritos
          </p>
        </div>
      </div>

      {/* Erro geral */}
      {estado?.erro && !estado.campo && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {estado.erro}
        </p>
      )}

      <div className="flex gap-2">
        <BotaoSubmit label={labelSubmit} />
        {onCancelar && (
          <Button type="button" variant="outline" onClick={onCancelar} className="w-full">
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}

// ─── Linha de evento na lista ─────────────────────────────────

function LinhaEvento({ evento }: { evento: EventoComOcorrencias }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(false)

  // Estado do form de edição
  const editarComId = editarEvento.bind(null, evento.id)
  const [estadoEditar, actionEditar] = useFormState(editarComId as (estado: EstadoFormEvento, formData: FormData) => Promise<EstadoFormEvento>, null)

  useEffect(() => {
    if (estadoEditar === null && editando) {
      setEditando(false)
      router.refresh()
    }
  }, [estadoEditar])

  const handleToggle = () => {
    startTransition(async () => {
      await toggleEventoAtivo(evento.id, !evento.ativo)
      router.refresh()
    })
  }

  const handleExcluir = async () => {
    const resultado = await excluirEvento(evento.id)
    if (resultado.erro) {
      setErroExcluir(resultado.erro)
      setConfirmandoExcluir(false)
    } else {
      router.refresh()
    }
  }

  const proximaOcorrencia = evento.ocorrencias[0]
  const totalInscritos = evento.ocorrencias.reduce((s, o) => s + o.inscritos, 0)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{evento.titulo}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  evento.ativo
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {evento.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-brand-light text-brand">
                {ROTULOS_RECORRENCIA[evento.recorrencia as RecorrenciaTipo]}
              </span>
            </div>

            <div className="mt-1 text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>
                {formatarHora(evento.hora_inicio)}–{formatarHora(evento.hora_fim)}
              </span>
              <span>
                {proximaOcorrencia
                  ? `Próxima: ${formatarData(proximaOcorrencia.data)}`
                  : 'Sem ocorrências futuras'}
              </span>
              <span>
                {totalInscritos} inscrito(s) total
              </span>
              <span>
                Cap: {evento.capacidade} vagas
              </span>
              <span>
                Lembrete: {evento.lembrete_horas}h antes
              </span>
            </div>

            {evento.descricao && (
              <p className="mt-1 text-sm text-gray-400 truncate">{evento.descricao}</p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Expandir ocorrências */}
            {evento.ocorrencias.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpandido(!expandido)}
                title="Ver ocorrências"
              >
                {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            {/* Toggle ativo */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggle}
              className={evento.ativo ? 'text-gray-600' : 'text-green-600'}
            >
              {evento.ativo ? 'Desativar' : 'Ativar'}
            </Button>
            {/* Editar */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditando(!editando)}
            >
              {editando ? <X className="h-4 w-4" /> : 'Editar'}
            </Button>
            {/* Excluir */}
            {!confirmandoExcluir ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmandoExcluir(true)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white h-8 px-2 text-xs"
                  onClick={handleExcluir}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setConfirmandoExcluir(false)}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </div>

        {erroExcluir && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {erroExcluir}
          </p>
        )}
      </div>

      {/* Lista de ocorrências */}
      {expandido && evento.ocorrencias.length > 0 && (
        <div className="border-t bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Próximas ocorrências</p>
          <div className="space-y-1">
            {evento.ocorrencias.slice(0, 8).map((oc) => (
              <div key={oc.data} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{formatarData(oc.data)}</span>
                <span className={`text-xs ${oc.vagasRestantes === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {oc.inscritos}/{evento.capacidade} inscritos
                  {oc.vagasRestantes === 0 && ' — Esgotado'}
                </span>
              </div>
            ))}
            {evento.ocorrencias.length > 8 && (
              <p className="text-xs text-gray-400">
                + {evento.ocorrencias.length - 8} ocorrência(s) futuras
              </p>
            )}
          </div>
        </div>
      )}

      {/* Formulário de edição inline */}
      {editando && (
        <div className="border-t bg-gray-50 px-4 py-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Editar evento</p>
          <FormEvento
            action={actionEditar}
            estado={estadoEditar}
            inicial={evento}
            onCancelar={() => setEditando(false)}
            labelSubmit="Salvar alterações"
          />
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────

export function EventosManager({ eventos }: { eventos: EventoComOcorrencias[] }) {
  const router = useRouter()
  const [mostrarFormCriacao, setMostrarFormCriacao] = useState(false)

  const [estadoCriar, actionCriar] = useFormState(
    criarEvento as (estado: EstadoFormEvento, formData: FormData) => Promise<EstadoFormEvento>,
    null
  )

  useEffect(() => {
    if (estadoCriar === null && mostrarFormCriacao) {
      setMostrarFormCriacao(false)
      router.refresh()
    }
  }, [estadoCriar])

  return (
    <div className="space-y-4">
      {/* Botão para abrir formulário */}
      {!mostrarFormCriacao && (
        <Button onClick={() => setMostrarFormCriacao(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo evento
        </Button>
      )}

      {/* Formulário de criação */}
      {mostrarFormCriacao && (
        <div className="border rounded-lg p-4 bg-white space-y-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-brand" />
            <h2 className="font-semibold text-gray-900">Novo evento</h2>
          </div>
          <FormEvento
            action={actionCriar}
            estado={estadoCriar}
            onCancelar={() => setMostrarFormCriacao(false)}
            labelSubmit="Criar evento"
          />
        </div>
      )}

      {/* Lista de eventos */}
      {eventos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarRange className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum evento cadastrado ainda.</p>
          <p className="text-xs mt-1">Clique em &quot;Novo evento&quot; para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map((evento) => (
            <LinhaEvento key={evento.id} evento={evento} />
          ))}
        </div>
      )}
    </div>
  )
}
