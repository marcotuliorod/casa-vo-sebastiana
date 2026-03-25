import { cn } from '@/lib/utils/cn'

interface Props {
  children: React.ReactNode
  className?: string
}

export function AdminCard({ children, className }: Props) {
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {children}
    </div>
  )
}

export function AdminCardBody({ children, className }: Props) {
  return <div className={cn('p-4', className)}>{children}</div>
}

export function AdminCardSub({ children, className }: Props) {
  return <div className={cn('border-t bg-gray-50 px-4 py-3', className)}>{children}</div>
}
