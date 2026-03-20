// Lista de consulentes com histórico de agendamentos
import { createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatarTelefone } from '@/lib/utils/phone'
import { formatarData } from '@/lib/utils/date'
import type { Cliente, Agendamento } from '@/types/database'
import { Users, Phone, Calendar } from 'lucide-react'

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

  // Para cada cliente, buscar contagem de agendamentos
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

      {clientesComDados.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">Nenhum consulente ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientesComDados.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-900 leading-tight">{c.nome}</h3>
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {c.total_agendamentos} atend.
                  </Badge>
                </div>

                <div className="space-y-1 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    <a
                      href={`https://wa.me/${c.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-green-600 hover:underline"
                    >
                      {formatarTelefone(c.telefone)}
                    </a>
                  </div>

                  {c.ultimo_agendamento && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Último: {formatarData(c.ultimo_agendamento)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
