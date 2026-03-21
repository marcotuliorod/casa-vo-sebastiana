// Gerenciamento de médiuns da casa
import { listarMediuns } from '@/lib/queries/mediuns'
import { MediunsManager } from './MediunsManager'

export const metadata = {
  title: 'Médiuns | Admin — Casa de Vó Sebastiana',
}

export default async function MediunsPage() {
  const mediuns = await listarMediuns()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Médiuns</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cadastre os médiuns da casa e compartilhe os links de acesso com cada um.
        </p>
      </div>

      <MediunsManager mediuns={mediuns} />
    </div>
  )
}
