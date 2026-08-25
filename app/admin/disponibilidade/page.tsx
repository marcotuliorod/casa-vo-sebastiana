// Gerenciamento da grade de horários
import { asc, gte } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import { db } from '@/lib/db'
import { gradeHorarios, datasBloqueadas } from '@/lib/db/schema'
import { GradeHorariosEditor } from './GradeHorariosEditor'
import { BloqueiosLista } from './BloqueiosLista'
import type { GradeHorario, DataBloqueada } from '@/types/database'

export const metadata = {
  title: 'Disponibilidade | Admin — Casa de Vó Sebastiana',
}

export default async function DisponibilidadePage() {
  const [linhasGrade, linhasBloqueios] = await Promise.all([
    db.select().from(gradeHorarios).orderBy(asc(gradeHorarios.diaSemana), asc(gradeHorarios.horaInicio)),
    db
      .select()
      .from(datasBloqueadas)
      .where(gte(datasBloqueadas.dataBloqueada, formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd')))
      .orderBy(asc(datasBloqueadas.dataBloqueada)),
  ])

  const grade: GradeHorario[] = linhasGrade.map((g) => ({
    id: g.id,
    dia_semana: g.diaSemana,
    hora_inicio: g.horaInicio,
    hora_fim: g.horaFim,
    ativo: g.ativo,
  }))

  const bloqueios: DataBloqueada[] = linhasBloqueios.map((b) => ({
    id: b.id,
    data_bloqueada: b.dataBloqueada,
    hora_inicio: b.horaInicio,
    hora_fim: b.horaFim,
    motivo: b.motivo,
    criado_em: b.criadoEm.toISOString(),
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Disponibilidade</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie a grade de horários e datas bloqueadas.
        </p>
      </div>

      {/* Grade semanal */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Grade semanal</h2>
        <GradeHorariosEditor grade={grade} />
      </section>

      {/* Bloqueios */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Datas / horários bloqueados</h2>
        <BloqueiosLista bloqueios={bloqueios} />
      </section>
    </div>
  )
}
