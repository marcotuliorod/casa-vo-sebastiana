'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard,
  Calendar,
  CalendarRange,
  Clock,
  Users,
  Sparkles,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/admin', label: 'Dashboard', icone: LayoutDashboard, exact: true },
  { href: '/admin/agendamentos', label: 'Agendamentos', icone: Calendar, exact: false },
  { href: '/admin/disponibilidade', label: 'Disponibilidade', icone: Clock, exact: false },
  { href: '/admin/eventos', label: 'Eventos', icone: CalendarRange, exact: false },
  { href: '/admin/consulentes', label: 'Consulentes', icone: Users, exact: false },
  { href: '/admin/mediuns', label: 'Médiuns', icone: Sparkles, exact: false },
]

export function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <nav className="flex-1 flex flex-col p-3">
      <ul className="space-y-1 flex-1">
        {navItems.map((item) => {
          const ativo = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  ativo
                    ? 'bg-brand-light text-brand'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icone className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </nav>
  )
}
