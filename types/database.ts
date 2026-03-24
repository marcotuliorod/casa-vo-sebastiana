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

export interface Medium {
  id: string
  nome: string
  especialidade: string | null
  telefone: string | null
  token_acesso: string
  ativo: boolean
  criado_em: string
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
  medium_id: string | null
  evento_id: string | null
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

// ─── Eventos ──────────────────────────────────────────────────

export type RecorrenciaTipo = 'nenhuma' | 'semanal' | 'quinzenal' | 'mensal'

export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  data_inicio: string            // 'YYYY-MM-DD'
  hora_inicio: string            // 'HH:MM'
  hora_fim: string               // 'HH:MM'
  capacidade: number
  recorrencia: RecorrenciaTipo
  data_fim_recorrencia: string | null  // 'YYYY-MM-DD'
  lembrete_horas: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

// Uma ocorrência concreta de um evento numa data específica
export interface OcorrenciaEvento {
  evento: Evento
  data: string           // 'YYYY-MM-DD'
  inscritos: number
  vagasRestantes: number
}

// ─── Tipos para o fluxo de agendamento ───────────────────────
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
