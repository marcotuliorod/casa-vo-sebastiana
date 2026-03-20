import { Logo } from '@/components/shared/Logo'

export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-background to-background">
      {/* Header */}
      <header className="pt-8 pb-4 text-center">
        <Logo size="md" />
      </header>

      {/* Conteúdo principal */}
      <main className="mx-auto max-w-lg px-4 pb-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400">
        <p>🌿 Com amor e fé — Casa de Vó Sebastiana</p>
      </footer>
    </div>
  )
}
