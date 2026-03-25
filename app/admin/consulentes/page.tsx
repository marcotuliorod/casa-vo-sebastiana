// Lista de consulentes com histórico de agendamentos
export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
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
  const supabase = createAdminClient()

  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .order('nome')

  const clientesComDados: ClienteComContagem[] = await Promise.all(
    (clientes ?? []).map(async (c: Cliente) => {
      const { count } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', c.id)
        .not('status', 'eq', 'cancelado')

      const { data: ultimo } = await supabase
        .from('agendamentos')
        .select('data_agendada')
        .eq('cliente_id', c.id)
        .not('status', 'eq', 'cancelado')
        .order('data_agendada', { ascending: false })
        .limit(1)
        .single()

      return {
        ...c,
        total_agendamentos: count ?? 0,
        ultimo_agendamento: ultimo?.data_agendada ?? null,
      }
    })
  )

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
