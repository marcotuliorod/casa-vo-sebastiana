import { listarEventos } from '@/lib/queries/eventos'
import { getOcorrenciasEvento } from '@/lib/queries/eventos'
import { EventosManager } from './EventosManager'
import type { OcorrenciaEvento } from '@/types/database'

export const metadata = { title: 'Eventos — Admin' }

export default async function EventosPage() {
  const eventos = await listarEventos()

  // Carrega ocorrências para todos os eventos em paralelo
  const ocorrenciasPorEvento = await Promise.all(
    eventos.map((e) => getOcorrenciasEvento(e))
  )

  const eventosComOcorrencias: Array<{
    id: string
    titulo: string
    descricao: string | null
    data_inicio: string
    hora_inicio: string
    hora_fim: string
    capacidade: number
    recorrencia: string
    data_fim_recorrencia: string | null
    lembrete_horas: number
    ativo: boolean
    criado_em: string
    atualizado_em: string
    ocorrencias: OcorrenciaEvento[]
  }> = eventos.map((evento, i) => ({
    ...evento,
    ocorrencias: ocorrenciasPorEvento[i],
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Crie e gerencie eventos com inscrições para os consulentes.
        </p>
      </div>

      <EventosManager eventos={eventosComOcorrencias} />
    </div>
  )
}
