import { RodapePublico } from '@/components/shared/RodapePublico'
import { Logo } from '@/components/shared/Logo'

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background">
      {/* Header */}
      <header className="pt-8 pb-4 text-center">
        <Logo size="md" href="/" />
      </header>

      {/* Conteúdo principal */}
      <main className="mx-auto max-w-lg px-4 pb-12">
        {children}
      </main>

      {/* Footer */}
      <RodapePublico />
    </div>
  )
}
