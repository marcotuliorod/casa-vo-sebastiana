import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

// Fontes servidas pelo próprio app (next/font baixa no build) — sem requisição
// ao Google no navegador, o que também simplifica a CSP.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-playfair', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  title: 'Casa de Vó Sebastiana — Agendamento Espiritual',
  description: 'Agende seu atendimento espiritual na Casa de Vó Sebastiana. Umbanda, consultas e orientações com amor e fé.',
  keywords: ['umbanda', 'agendamento espiritual', 'consulta espiritual', 'terreiro'],
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
    shortcut: '/favicon.png',
  },
  openGraph: {
    title: 'Casa de Vó Sebastiana',
    description: 'Agende seu atendimento espiritual',
    type: 'website',
    images: [{ url: '/logo-vertical.png', width: 1408, height: 768, alt: 'Casa de Vó Sebastiana' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  )
}
