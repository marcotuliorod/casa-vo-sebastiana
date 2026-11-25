export const dynamic = 'force-dynamic'

import { getInfoCasa } from '@/lib/queries/casa'
import { CasaForm } from './CasaForm'

export const metadata = {
  title: 'Informações da Casa | Admin — Casa de Vó Sebastiana',
}

export default async function CasaPage() {
  const info = await getInfoCasa()

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-serif font-bold text-gray-900">Informações da Casa</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aparecem na página inicial, na página do agendamento e nos e-mails aos consulentes.
          Campos em branco não aparecem.
        </p>
      </div>

      <CasaForm info={info} />
    </div>
  )
}
