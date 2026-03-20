import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Casa de Vó Sebastiana — Agendamento Espiritual',
  description: 'Agende seu atendimento espiritual na Casa de Vó Sebastiana. Umbanda, consultas e orientações com amor e fé.',
  keywords: ['umbanda', 'agendamento espiritual', 'consulta espiritual', 'terreiro'],
  openGraph: {
    title: 'Casa de Vó Sebastiana',
    description: 'Agende seu atendimento espiritual',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  )
}
