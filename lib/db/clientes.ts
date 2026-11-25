// Cadastro do consulente: gravação pelo formulário público, conflito de telefone,
// exclusão completa e limpeza dos cadastros antigos (LGPD).

import { eq, inArray, sql } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import { subYears } from 'date-fns'
import type { db } from '@/lib/db'
import { agendamentos, clientes, emailQueue } from '@/lib/db/schema'
import { RETENCAO_CADASTRO_ANOS, VERSAO_TEXTOS_LGPD } from '@/lib/consentimento'

type ExecutorInsert = Pick<typeof db, 'insert'>
type ExecutorSelect = Pick<typeof db, 'select'>
type ExecutorTransacao = Pick<typeof db, 'select' | 'delete'>

/**
 * O telefone já pertence a um cadastro com OUTRO e-mail?
 *
 * Nesse caso o pedido é recusado: senão o agendamento ficaria no cadastro de outra
 * pessoa, que receberia os e-mails da Casa e veria o pedido no histórico dela, e a
 * autorização de quem pediu não ficaria registrada. Cadastro sem e-mail (antigo)
 * não conta como conflito.
 */
export async function telefoneDeOutroCadastro(
  executor: ExecutorSelect,
  telefone: string,
  email: string
): Promise<boolean> {
  const [existente] = await executor
    .select({ email: clientes.email })
    .from(clientes)
    .where(eq(clientes.telefone, telefone))
    .limit(1)
  return Boolean(existente?.email && existente.email.toLowerCase() !== email.toLowerCase())
}

/**
 * Salva o consulente pelo telefone (a chave do cadastro).
 *
 * Se o telefone já existe, o formulário público NÃO troca o e-mail do cadastro:
 * senão, quem soubesse o telefone de outra pessoa poderia apontar o cadastro
 * (e o "Meus agendamentos", que é buscado pelo e-mail) para o próprio e-mail.
 * - o e-mail só é preenchido quando o cadastro antigo não tinha nenhum;
 * - o nome só é atualizado quando o e-mail informado é o mesmo do cadastro.
 * Trocar o e-mail de um consulente é tarefa da Casa, pelo painel.
 *
 * Grava também quando a pessoa autorizou o uso dos dados e a versão do texto
 * aceito (consentimento_em/consentimento_versao), com a mesma regra do nome.
 */
export function salvarCliente(
  executor: ExecutorInsert,
  dados: { nome: string; telefone: string; email: string }
) {
  const mesmoDono = sql`${clientes.email} IS NULL OR lower(${clientes.email}) = lower(excluded.email)`
  return executor
    .insert(clientes)
    .values({ ...dados, consentimentoEm: new Date(), consentimentoVersao: VERSAO_TEXTOS_LGPD })
    .onConflictDoUpdate({
      target: clientes.telefone,
      set: {
        nome: sql`CASE WHEN ${mesmoDono} THEN excluded.nome ELSE ${clientes.nome} END`,
        email: sql`COALESCE(${clientes.email}, excluded.email)`,
        consentimentoEm: sql`CASE WHEN ${mesmoDono} THEN excluded.consentimento_em ELSE ${clientes.consentimentoEm} END`,
        consentimentoVersao: sql`CASE WHEN ${mesmoDono} THEN excluded.consentimento_versao ELSE ${clientes.consentimentoVersao} END`,
      },
    })
    .returning()
}

/**
 * Apaga o consulente com todo o histórico (exclusão de dados, LGPD). Rode numa transação.
 * Os itens da fila de e-mail guardam o texto das mensagens (nome, telefone, e-mail),
 * então saem primeiro; agendamentos.cliente_id é ON DELETE RESTRICT, então o histórico
 * sai antes do cadastro; logs_email cai junto (cascade).
 */
export async function apagarClienteComHistorico(tx: ExecutorTransacao, clienteId: string) {
  const idsAgendamentos = tx
    .select({ id: agendamentos.id })
    .from(agendamentos)
    .where(eq(agendamentos.clienteId, clienteId))
  await tx.delete(emailQueue).where(inArray(emailQueue.agendamentoId, idsAgendamentos))
  await tx.delete(agendamentos).where(eq(agendamentos.clienteId, clienteId))
  await tx.delete(clientes).where(eq(clientes.id, clienteId))
}

/** Data (YYYY-MM-DD, Brasília) antes da qual o último atendimento faz o cadastro vencer. */
export function corteRetencaoCadastro(agora: Date): string {
  return formatInTimeZone(subYears(agora, RETENCAO_CADASTRO_ANOS), 'America/Sao_Paulo', 'yyyy-MM-dd')
}

/**
 * Cadastros vencidos: último atendimento (ou, sem atendimentos, o cadastro) antes do
 * corte e nenhum agendamento a partir dele. Limite por rodada para não pesar no cron.
 */
export async function idsCadastrosVencidos(executor: Pick<typeof db, 'execute'>, agora: Date, limite = 100) {
  const corte = corteRetencaoCadastro(agora)
  const linhas = await executor.execute<{ id: string }>(sql`
    SELECT c.id FROM ${clientes} c
    LEFT JOIN ${agendamentos} a ON a.cliente_id = c.id
    GROUP BY c.id
    HAVING COALESCE(MAX(a.data_agendada), (c.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) < ${corte}::date
    LIMIT ${limite}
  `)
  return Array.from(linhas, (l) => l.id)
}
