// Endereço, mapa, contato e orientações da Casa (editados em /admin/casa).
// Mostra só o que estiver preenchido; sem nada preenchido, não renderiza.
import { MapPin, Mail, Phone, Info } from 'lucide-react'
import { TextoFormatado } from '@/components/shared/TextoFormatado'
import { emailDeContato, type InfoCasa } from '@/lib/queries/casa'
import { cn } from '@/lib/utils/cn'

interface Props {
  info: InfoCasa
  /** Mostrar as orientações e a política de cancelamento (página do agendamento) */
  comOrientacoes?: boolean
  className?: string
}

export function InfoCasaBloco({ info, comOrientacoes = false, className }: Props) {
  const email = emailDeContato(info)
  const telefone = info.telefoneContato
  const temLocal = Boolean(info.endereco || info.linkMapa)
  const temContato = Boolean(email || telefone)
  const temOrientacoes = comOrientacoes && Boolean(info.orientacoes || info.politicaCancelamento)
  if (!temLocal && !temContato && !temOrientacoes) return null

  return (
    <section
      aria-label="Informações da Casa"
      className={cn('w-full rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 space-y-3', className)}
    >
      {temLocal && (
        <div className="flex gap-3">
          <MapPin className="h-5 w-5 flex-shrink-0 text-brand-dark" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-gray-900">Onde fica</p>
            {info.endereco && <p>{info.endereco}</p>}
            {info.linkMapa && (
              <a
                href={info.linkMapa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-1 text-brand-dark underline underline-offset-2"
              >
                Ver no mapa
              </a>
            )}
          </div>
        </div>
      )}

      {temOrientacoes && (
        <div className="flex gap-3">
          <Info className="h-5 w-5 flex-shrink-0 text-brand-dark" aria-hidden="true" />
          <div className="space-y-2">
            <p className="font-semibold text-gray-900">Antes de vir</p>
            {info.orientacoes && <TextoFormatado texto={info.orientacoes} />}
            {info.politicaCancelamento && <TextoFormatado texto={info.politicaCancelamento} />}
          </div>
        </div>
      )}

      {temContato && (
        <div className="flex gap-3">
          {email ? (
            <Mail className="h-5 w-5 flex-shrink-0 text-brand-dark" aria-hidden="true" />
          ) : (
            <Phone className="h-5 w-5 flex-shrink-0 text-brand-dark" aria-hidden="true" />
          )}
          <div className="space-y-1">
            <p className="font-semibold text-gray-900">Contato</p>
            {email && (
              <a href={`mailto:${email}`} className="block py-1 text-brand-dark underline underline-offset-2 break-all">
                {email}
              </a>
            )}
            {telefone && (
              <a
                href={`tel:${telefone.replace(/[^\d+]/g, '')}`}
                className="block py-1 text-brand-dark underline underline-offset-2"
              >
                {telefone}
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
