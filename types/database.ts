// Tipos manuais das tabelas do Supabase
// Em produção, gerar via: npx supabase gen types typescript --project-id <ID>

export type AppointmentStatus =
  | 'pendente'
  | 'confirmado'
  | 'cancelado'
  | 'realizado'
  | 'nao_compareceu'

export type WhatsappEvento =
  | 'confirmacao_agendamento'
  | 'lembrete_24h'
  | 'cancelamento'

export type WhatsappStatus = 'na_fila' | 'enviado' | 'entregue' | 'falhou'

export interface Cliente {
  id: string
  nome: string
  telefone: string
  email: string | null
  notas: string | null
  criado_em: string
  atualizado_em: string
}

export interface GradeHorario {
  id: string
  dia_semana: number // 0=Dom, 1=Seg, ..., 6=Sáb
  hora_inicio: string // '09:00'
  hora_fim: string    // '09:30'
  ativo: boolean
}

export interface DataBloqueada {
  id: string
  data_bloqueada: string // 'YYYY-MM-DD'
  hora_inicio: string | null
  hora_fim: string | null
  motivo: string | null
  criado_em: string
}

export interface Agendamento {
  id: string
  cliente_id: string
  data_agendada: string  // 'YYYY-MM-DD'
  hora_inicio: string    // 'HH:MM'
  hora_fim: string       // 'HH:MM'
  status: AppointmentStatus
  notas: string | null
  motivo_cancelamento: string | null
  token_publico: string
  lembrete_enviado: boolean
  criado_em: string
  atualizado_em: string
}

export interface AgendamentoComCliente extends Agendamento {
  clientes: Cliente
}

export interface LogWhatsapp {
  id: string
  agendamento_id: string
  evento: WhatsappEvento
  provedor: string
  para_telefone: string
  mensagem: string
  id_mensagem_provedor: string | null
  status: WhatsappStatus
  mensagem_erro: string | null
  criado_em: string
  atualizado_em: string
}

// Tipos para o fluxo de agendamento
export interface SlotDisponivel {
  hora_inicio: string
  hora_fim: string
}

export interface DadosAgendamento {
  data: string
  slot: SlotDisponivel
  nome: string
  telefone: string
  email?: string
  notas?: string
}
