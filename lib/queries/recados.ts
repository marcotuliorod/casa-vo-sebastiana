import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { recados } from '@/lib/db/schema'
import type { Recado } from '@/types/database'

export async function listarRecados(): Promise<Recado[]> {
  const linhas = await db
    .select()
    .from(recados)
    .where(eq(recados.ativo, true))
    .orderBy(desc(recados.fixado), desc(recados.criadoEm))

  return linhas.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    conteudo: r.conteudo,
    prioridade: r.prioridade as Recado['prioridade'],
    fixado: r.fixado,
    ativo: r.ativo,
    criado_em: r.criadoEm.toISOString(),
    atualizado_em: r.atualizadoEm.toISOString(),
  }))
}
