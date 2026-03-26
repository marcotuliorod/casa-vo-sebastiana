// Lista de consulentes com histórico de agendamentos
export const dynamic = 'force-dynamic'

import { createServerSessionClient } from '@/lib/supabase/server'
import { ConsulentesManager } from './ConsulentesManager'
import type { Cliente } from '@/types/database'

export const metadata = {
  title: 'Consulentes | Admin — Casa de Vó Sebastiana',
}

interface ClienteComContagem extends Cliente {
  total_agendamentos: number
  ultimo_agendamento: string | null
}

export default async function ConsulentesPage() {
  const supabase = await createServerSessionClient()

  const [{ data: clientes }, { data: agendamentos }] = await Promise.all([
    supabase.from('clientes').select('*').order('nome'),
    supabase
      .from('agendamentos')
      .select('cliente_id, data_agendada')
      .not('status', 'eq', 'cancelado')
      .order('data_agendada', { ascending: false }),
  ])

  const agsPorCliente = new Map<string, { total: number; ultimo: string | null }>()
  for (const ag of agendamentos ?? []) {
    const entry = agsPorCliente.get(ag.cliente_id)
    if (!entry) {
      agsPorCliente.set(ag.cliente_id, { total: 1, ultimo: ag.data_agendada })
    } else {
      entry.total += 1
      if (!entry.ultimo || ag.data_agendada > entry.ultimo) entry.ultimo = ag.data_agendada
    }
  }

  const clientesComDados: ClienteComContagem[] = (clientes ?? []).map((c: Cliente) => {
    const info = agsPorCliente.get(c.id)
    return {
      ...c,
      total_agendamentos: info?.total ?? 0,
      ultimo_agendamento: info?.ultimo ?? null,
    }
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Consulentes</h1>
        <p className="text-sm text-gray-500 mt-1">
          {clientesComDados.length} consulente{clientesComDados.length !== 1 ? 's' : ''} cadastrado{clientesComDados.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ConsulentesManager clientes={clientesComDados} />
    </div>
  )
}
