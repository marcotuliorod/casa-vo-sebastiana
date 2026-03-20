import { Badge } from '@/components/ui/badge'
import type { AppointmentStatus } from '@/types/database'

interface StatusBadgeProps {
  status: AppointmentStatus
}

const config: Record<AppointmentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  pendente: { label: 'Pendente', variant: 'warning' },
  confirmado: { label: 'Confirmado', variant: 'success' },
  cancelado: { label: 'Cancelado', variant: 'destructive' },
  realizado: { label: 'Realizado', variant: 'secondary' },
  nao_compareceu: { label: 'Não compareceu', variant: 'outline' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, variant } = config[status] ?? { label: status, variant: 'outline' }
  return <Badge variant={variant}>{label}</Badge>
}
