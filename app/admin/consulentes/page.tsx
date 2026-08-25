// Lista de consulentes com histórico de agendamentos
export const dynamic = 'force-dynamic'

import { asc, desc, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, clientes } from '@/lib/db/schema'
import { mapCliente } from '@/lib/db/mappers'
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
  const [linhasClientes, linhasAgendamentos] = await Promise.all([
    db.select().from(clientes).orderBy(asc(clientes.nome)),
    db
      .select({ clienteId: agendamentos.clienteId, dataAgendada: agendamentos.dataAgendada })
      .from(agendamentos)
      .where(ne(agendamentos.status, 'cancelado'))
      .orderBy(desc(agendamentos.dataAgendada)),
  ])

  const agsPorCliente = new Map<string, { total: number; ultimo: string | null }>()
  for (const ag of linhasAgendamentos) {
    const entry = agsPorCliente.get(ag.clienteId)
    if (!entry) {
      agsPorCliente.set(ag.clienteId, { total: 1, ultimo: ag.dataAgendada })
    } else {
      entry.total += 1
      if (!entry.ultimo || ag.dataAgendada > entry.ultimo) entry.ultimo = ag.dataAgendada
    }
  }

  const clientesComDados: ClienteComContagem[] = linhasClientes.map((c) => {
    const cliente = mapCliente(c)
    const info = agsPorCliente.get(cliente.id)
    return {
      ...cliente,
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
