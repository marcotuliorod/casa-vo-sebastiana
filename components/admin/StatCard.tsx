import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  titulo: string
  valor: number
  descricao?: string
  icone: LucideIcon
  cor?: 'purple' | 'green' | 'amber' | 'blue'
  href?: string
}

const cores = {
  purple: 'bg-brand-light text-brand border-brand-muted/30',
  green: 'bg-green-50 text-green-700 border-green-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
}

export function StatCard({ titulo, valor, descricao, icone: Icone, cor = 'purple', href }: StatCardProps) {
  const card = (
    <Card className={cn('border', cores[cor], href && 'cursor-pointer hover:shadow-md transition-shadow')}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{titulo}</p>
            <p className="text-3xl font-bold mt-1">{valor}</p>
            {descricao && <p className="text-xs mt-1 opacity-60">{descricao}</p>}
          </div>
          <Icone className="h-10 w-10 opacity-20" />
        </div>
      </CardContent>
    </Card>
  )

  if (href) return <Link href={href}>{card}</Link>
  return card
}
