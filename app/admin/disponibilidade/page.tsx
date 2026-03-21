// Gerenciamento da grade de horários
import { formatInTimeZone } from 'date-fns-tz'
import { createAdminClient } from '@/lib/supabase/server'
import { GradeHorariosEditor } from './GradeHorariosEditor'
import { BloqueiosLista } from './BloqueiosLista'
import type { GradeHorario, DataBloqueada } from '@/types/database'

export const metadata = {
  title: 'Disponibilidade | Admin — Casa de Vó Sebastiana',
}

export default async function DisponibilidadePage() {
  const supabase = createAdminClient()

  const [gradeResult, bloqueiosResult] = await Promise.all([
    supabase
      .from('grade_horarios')
      .select('*')
      .order('dia_semana')
      .order('hora_inicio'),
    supabase
      .from('datas_bloqueadas')
      .select('*')
      .gte('data_bloqueada', formatInTimeZone(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd'))
      .order('data_bloqueada'),
  ])

  const grade = (gradeResult.data ?? []) as GradeHorario[]
  const bloqueios = (bloqueiosResult.data ?? []) as DataBloqueada[]

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
