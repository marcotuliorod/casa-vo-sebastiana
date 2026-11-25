'use server'

// Server Actions para o fluxo de agendamento público

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { and, count, eq, gte, lt, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agendamentos, clientes } from '@/lib/db/schema'
import { codigoPg } from '@/lib/db/errors'
import { salvarCliente } from '@/lib/db/clientes'
import { getSlotsDisponiveis } from '@/lib/queries/availability'
import {
  emailConfirmacao,
  emailCancelamento,
  emailNovoAgendamentoAdmin,
  emailCancelamentoAdmin,
  emailConfirmacaoEvento,
} from '@/lib/email/templates'
import { getEvento, contarInscritosOcorrencia } from '@/lib/queries/eventos'
import { ehOcorrenciaValida } from '@/lib/utils/recorrencia'
import { normalizarTelefone, validarTelefone } from '@/lib/utils/phone'
import { dataLimiteAgendamento, ehDataPassada, hojeBr, horaAgoraBr } from '@/lib/utils/date'
import { enviarEmailComFila } from '@/lib/email/envio'
import { listaDeEmails } from '@/lib/email/cliente'
import { LIMITES, MENSAGEM_LIMITE, consumirLimite, ipDaRequisicao } from '@/lib/rate-limit'

// Campos do consulente, comuns ao agendamento e à inscrição em evento
const campoNome = z
  .string()
  .trim()
  .min(3, 'Nome deve ter pelo menos 3 caracteres')
  .max(120, 'Nome muito longo')
const campoTelefone = z
  .string()
  .min(10, 'Telefone inválido')
  .max(20, 'Telefone inválido')
  .refine(validarTelefone, 'Telefone inválido')
// E-mail é o único canal de comunicação com o consulente
const campoEmail = z
  .string()
  .trim()
  .min(1, 'Informe seu e-mail')
  .max(254, 'E-mail inválido')
  .email('E-mail inválido')
  .toLowerCase()

// Schema de validação para criação de agendamento
const schemaCriarAgendamento = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  nome: campoNome,
  telefone: campoTelefone,
  email: campoEmail,
  notas: z.string().max(500).optional(),
})

// Recusa datas e horários que a página de agendamento não oferece:
// passado, além do horizonte do calendário ou horário de hoje que já passou.
function erroDeData(data: string, horaInicio?: string): string | null {
  if (ehDataPassada(data)) return 'Esta data já passou. Por favor, escolha outra.'
  if (data > dataLimiteAgendamento()) return 'Esta data ainda não está aberta para agendamento.'
  if (horaInicio && data === hojeBr() && horaInicio <= horaAgoraBr()) {
    return 'Este horário já passou. Por favor, escolha outro.'
  }
  return null
}

export type EstadoFormAgendamento = {
  erro?: string
  campo?: string
} | null

export async function criarAgendamento(
  _estado: EstadoFormAgendamento,
  formData: FormData
): Promise<EstadoFormAgendamento> {
  const dados = Object.fromEntries(formData.entries())

  const resultado = schemaCriarAgendamento.safeParse(dados)
  if (!resultado.success) {
    const primeiroErro = resultado.error.issues[0]
    return { erro: primeiroErro.message, campo: String(primeiroErro.path[0]) }
  }

  const { data, hora_inicio, hora_fim, nome, telefone, email, notas } = resultado.data
  const telefoneNormalizado = normalizarTelefone(telefone)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  const erroData = erroDeData(data, hora_inicio)
  if (erroData) return { erro: erroData }

  // Freia quem tenta lotar a agenda em sequência
  if (!consumirLimite(`agendar:${await ipDaRequisicao()}`, LIMITES.agendarPorIp)) {
    return { erro: MENSAGEM_LIMITE }
  }

  // 0a. US-19: verificar limite de agendamentos por cliente por mês
  const limiteStr = process.env.MAX_AGENDAMENTOS_MES
  if (limiteStr) {
    const limite = parseInt(limiteStr, 10)
    if (!isNaN(limite) && limite > 0) {
      const inicioMes = `${data.slice(0, 7)}-01`
      const [anoNum, mesNum] = data.split('-').map(Number)
      const inicioProxMes = mesNum === 12
        ? `${anoNum + 1}-01-01`
        : `${anoNum}-${String(mesNum + 1).padStart(2, '0')}-01`

      const [clienteExistente] = await db
        .select({ id: clientes.id })
        .from(clientes)
        .where(eq(clientes.telefone, telefoneNormalizado))
        .limit(1)

      if (clienteExistente) {
        const [{ value: totalNoMes }] = await db
          .select({ value: count() })
          .from(agendamentos)
          .where(
            and(
              eq(agendamentos.clienteId, clienteExistente.id),
              gte(agendamentos.dataAgendada, inicioMes),
              lt(agendamentos.dataAgendada, inicioProxMes),
              ne(agendamentos.status, 'cancelado')
            )
          )

        if (totalNoMes >= limite) {
          return {
            erro: `Você já tem ${limite} agendamento${limite !== 1 ? 's' : ''} neste mês. Entre em contato com a casa para mais informações.`,
          }
        }
      }
    }
  }

  // 0b. Validar que o slot solicitado existe e está disponível (BUG-02)
  const { slots } = await getSlotsDisponiveis(data)
  const slotValido = slots.some(
    (s) => s.hora_inicio === hora_inicio && s.hora_fim === hora_fim
  )
  if (!slotValido) {
    return { erro: 'Este horário não está mais disponível. Por favor, escolha outro.' }
  }

  // 1. Cadastro do cliente (por telefone)
  let cliente
  try {
    ;[cliente] = await salvarCliente(db, { nome, telefone: telefoneNormalizado, email })
  } catch {
    return { erro: 'Erro ao salvar seus dados. Tente novamente.' }
  }

  // 2. Criar agendamento
  let agendamento
  try {
    ;[agendamento] = await db
      .insert(agendamentos)
      .values({
        clienteId: cliente.id,
        dataAgendada: data,
        horaInicio: hora_inicio,
        horaFim: hora_fim,
        status: 'pendente',
        notas: notas || null,
      })
      .returning()
  } catch (erro) {
    // Constraint de sobreposição ativada
    if (codigoPg(erro) === '23P01') {
      return { erro: 'Este horário já foi preenchido. Por favor, escolha outro.' }
    }
    return { erro: 'Erro ao criar agendamento. Tente novamente.' }
  }

  // 3. Confirmação por e-mail. Falha (ex.: Resend sem chave) não cancela o
  // agendamento: vira item da fila, reenviado pelo cron.
  await enviarEmailComFila({
    agendamentoId: agendamento.id,
    para: [email],
    email: emailConfirmacao({
      nomeCliente: nome,
      dataAgendada: data,
      horaInicio: hora_inicio,
      tokenPublico: agendamento.tokenPublico,
      baseUrl,
    }),
    evento: 'confirmacao_agendamento',
    tipo: 'confirmacao',
  })

  // 4. Avisar a Casa (US-17). Sem log: logs_email é o histórico do consulente.
  await enviarEmailComFila({
    agendamentoId: agendamento.id,
    para: listaDeEmails(process.env.ADMIN_EMAIL_NOTIFICACOES),
    email: emailNovoAgendamentoAdmin({
      nomeCliente: nome,
      telefoneCliente: telefoneNormalizado,
      emailCliente: email,
      dataAgendada: data,
      horaInicio: hora_inicio,
      horaFim: hora_fim,
    }),
    evento: null,
    tipo: 'admin',
  })

  // 5. Redirecionar para a página de confirmação
  redirect(`/agendamento/${agendamento.tokenPublico}`)
}

// ─── Inscrição em Evento ──────────────────────────────────────

const schemaInscreverEvento = z.object({
  evento_id: z.string().uuid('Evento inválido'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  nome: campoNome,
  telefone: campoTelefone,
  email: campoEmail,
  notas: z.string().max(500).optional(),
})

type ResultadoInscricao =
  | { erro: string }
  | { agendamento: typeof agendamentos.$inferSelect }

export async function inscreverEmEvento(
  _estado: EstadoFormAgendamento,
  formData: FormData
): Promise<EstadoFormAgendamento> {
  const dados = Object.fromEntries(formData.entries())
  const resultado = schemaInscreverEvento.safeParse(dados)

  if (!resultado.success) {
    const primeiroErro = resultado.error.issues[0]
    return { erro: primeiroErro.message, campo: String(primeiroErro.path[0]) }
  }

  const { evento_id, data, nome, telefone, email, notas } = resultado.data
  const telefoneNormalizado = normalizarTelefone(telefone)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  if (!consumirLimite(`evento:${await ipDaRequisicao()}`, LIMITES.eventoPorIp)) {
    return { erro: MENSAGEM_LIMITE }
  }

  // 1. Verificar evento ativo
  const evento = await getEvento(evento_id)
  if (!evento || !evento.ativo) {
    return { erro: 'Este evento não está disponível.' }
  }

  // 2. Verificar que a data é uma ocorrência válida do evento
  const ocorrenciaValida = ehOcorrenciaValida({
    data,
    data_inicio: evento.data_inicio,
    recorrencia: evento.recorrencia,
    data_fim_recorrencia: evento.data_fim_recorrencia,
  })
  if (!ocorrenciaValida) {
    return { erro: 'Data inválida para este evento.' }
  }

  // 3–5. Conferir vagas, salvar o cliente e inscrever numa transação só.
  // A trava (por evento e data) faz inscrições simultâneas esperarem a vez,
  // para que duas pessoas não ocupem a última vaga ao mesmo tempo.
  let agendamento
  try {
    const resultadoInscricao: ResultadoInscricao = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`inscricao:${evento_id}:${data}`}))`
      )

      const inscritos = await contarInscritosOcorrencia(evento_id, data, tx)
      if (inscritos >= evento.capacidade) {
        return { erro: 'Não há mais vagas disponíveis para esta data.' }
      }

      const [cliente] = await salvarCliente(tx, { nome, telefone: telefoneNormalizado, email })

      const [novo] = await tx
        .insert(agendamentos)
        .values({
          clienteId: cliente.id,
          eventoId: evento_id,
          dataAgendada: data,
          horaInicio: evento.hora_inicio,
          horaFim: evento.hora_fim,
          status: 'pendente',
          notas: notas || null,
        })
        .returning()
      return { agendamento: novo }
    })

    if ('erro' in resultadoInscricao) return { erro: resultadoInscricao.erro }
    agendamento = resultadoInscricao.agendamento
  } catch {
    return { erro: 'Erro ao registrar inscrição. Tente novamente.' }
  }

  // 6. Confirmação por e-mail (falha vira item da fila)
  const horaInicio = evento.hora_inicio.slice(0, 5)
  const horaFim = evento.hora_fim.slice(0, 5)
  await enviarEmailComFila({
    agendamentoId: agendamento.id,
    para: [email],
    email: emailConfirmacaoEvento({
      nomeCliente: nome,
      tituloEvento: evento.titulo,
      dataEvento: data,
      horaInicio,
      horaFim,
      tokenPublico: agendamento.tokenPublico,
      baseUrl,
    }),
    evento: 'confirmacao_agendamento',
    tipo: 'confirmacao',
  })

  // 7. Avisar a Casa
  await enviarEmailComFila({
    agendamentoId: agendamento.id,
    para: listaDeEmails(process.env.ADMIN_EMAIL_NOTIFICACOES),
    email: emailNovoAgendamentoAdmin({
      nomeCliente: nome,
      telefoneCliente: telefoneNormalizado,
      emailCliente: email,
      dataAgendada: data,
      horaInicio,
      horaFim,
      tituloEvento: evento.titulo,
    }),
    evento: null,
    tipo: 'admin',
  })

  redirect(`/agendamento/${agendamento.tokenPublico}`)
}

// ─── Cancelar agendamento pelo token público ──────────────────
export async function cancelarAgendamento(token: string): Promise<{ erro?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // Buscar o agendamento
  const agendamento = await db.query.agendamentos.findFirst({
    where: eq(agendamentos.tokenPublico, token),
    with: { cliente: true },
  })

  if (!agendamento) {
    return { erro: 'Agendamento não encontrado.' }
  }

  if (agendamento.status === 'cancelado') {
    return { erro: 'Este agendamento já foi cancelado.' }
  }

  if (agendamento.status === 'realizado') {
    return { erro: 'Não é possível cancelar um atendimento já realizado.' }
  }

  // Atualizar status
  try {
    await db.update(agendamentos).set({ status: 'cancelado' }).where(eq(agendamentos.id, agendamento.id))
  } catch {
    return { erro: 'Erro ao cancelar. Tente novamente.' }
  }

  // E-mail de cancelamento ao consulente (falha vira item da fila).
  // Consulentes antigos podem não ter e-mail: aí não há o que enviar.
  await enviarEmailComFila({
    agendamentoId: agendamento.id,
    para: listaDeEmails(agendamento.cliente.email),
    email: emailCancelamento({
      nomeCliente: agendamento.cliente.nome,
      dataAgendada: agendamento.dataAgendada,
      horaInicio: agendamento.horaInicio.slice(0, 5),
      tokenPublico: token,
      baseUrl,
    }),
    evento: 'cancelamento',
    tipo: 'cancelamento',
  })

  // Avisar a Casa (US-21)
  await enviarEmailComFila({
    // Sem agendamentoId: o cron descarta itens de agendamento cancelado (motivoDescarte),
    // e este aviso é justamente sobre o cancelamento.
    agendamentoId: null,
    para: listaDeEmails(process.env.ADMIN_EMAIL_NOTIFICACOES),
    email: emailCancelamentoAdmin({
      nomeCliente: agendamento.cliente.nome,
      telefoneCliente: agendamento.cliente.telefone,
      emailCliente: agendamento.cliente.email,
      dataAgendada: agendamento.dataAgendada,
      horaInicio: agendamento.horaInicio.slice(0, 5),
      horaFim: agendamento.horaFim.slice(0, 5),
    }),
    evento: null,
    tipo: 'admin',
  })

  return {}
}
