// Converte as linhas do Drizzle (camelCase, timestamps como Date) para os
// tipos de app em types/database.ts (snake_case, datas como string ISO) —
// evita reescrever o resto do app (components, actions) que já espera esse
// formato vindo dos tempos do supabase-js.

import type { agendamentos, clientes, mediuns } from './schema'
import type { AgendamentoComCliente, Cliente, Medium } from '@/types/database'

export function mapCliente(c: typeof clientes.$inferSelect): Cliente {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    notas: c.notas,
    criado_em: c.criadoEm.toISOString(),
    atualizado_em: c.atualizadoEm.toISOString(),
  }
}

export function mapMedium(m: typeof mediuns.$inferSelect): Medium {
  return {
    id: m.id,
    nome: m.nome,
    especialidade: m.especialidade,
    telefone: m.telefone,
    token_acesso: m.tokenAcesso,
    ativo: m.ativo,
    criado_em: m.criadoEm.toISOString(),
  }
}

export function mapAgendamentoComCliente(
  row: typeof agendamentos.$inferSelect & { cliente: typeof clientes.$inferSelect }
): AgendamentoComCliente {
  return {
    id: row.id,
    cliente_id: row.clienteId,
    data_agendada: row.dataAgendada,
    hora_inicio: row.horaInicio,
    hora_fim: row.horaFim,
    status: row.status,
    notas: row.notas,
    motivo_cancelamento: row.motivoCancelamento,
    medium_id: row.mediumId,
    evento_id: row.eventoId,
    token_publico: row.tokenPublico,
    lembrete_enviado: row.lembreteEnviado,
    criado_em: row.criadoEm.toISOString(),
    atualizado_em: row.atualizadoEm.toISOString(),
    clientes: mapCliente(row.cliente),
  }
}
