import { Loader2 } from 'lucide-react'

/** Indicador de carregamento das páginas públicas (usado nos loading.tsx). */
export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
      <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}
