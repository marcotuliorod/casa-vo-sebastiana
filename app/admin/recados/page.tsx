export const dynamic = 'force-dynamic'

import { listarRecados } from '@/lib/queries/recados'
import { RecadosManager } from './RecadosManager'

export const metadata = {
  title: 'Mural de Recados | Admin — Casa de Vó Sebastiana',
}

export default async function RecadosPage() {
  const recados = await listarRecados()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Mural de Recados</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie avisos exibidos na área dos médiuns.
        </p>
      </div>

      <RecadosManager recados={recados} />
    </div>
  )
}
