import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSessionClient } from '@/lib/supabase/server'
import { Logo } from '@/components/shared/Logo'
import { AdminNav } from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSessionClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 flex-col bg-white border-r shadow-sm">
        <div className="p-5 border-b">
          <Logo size="sm" className="flex-col" />
        </div>
        <AdminNav />
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile */}
        <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
          <Logo size="sm" className="flex-row gap-2" />
        </header>

        {/* Nav mobile */}
        <nav className="md:hidden bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto">
          <Link href="/admin" className="text-xs text-purple-700 font-medium whitespace-nowrap px-3 py-1.5 rounded-full bg-purple-50">
            Dashboard
          </Link>
          <Link href="/admin/agendamentos" className="text-xs text-gray-600 whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-gray-100">
            Agendamentos
          </Link>
          <Link href="/admin/disponibilidade" className="text-xs text-gray-600 whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-gray-100">
            Disponibilidade
          </Link>
          <Link href="/admin/consulentes" className="text-xs text-gray-600 whitespace-nowrap px-3 py-1.5 rounded-full hover:bg-gray-100">
            Consulentes
          </Link>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
