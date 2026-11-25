// Páginas do agendamento (acesso pelo link do e-mail): mostram nome e telefone,
// então nunca devem ir para buscadores.
export const metadata = {
  title: 'Seu agendamento',
  robots: { index: false, follow: false },
}

export default function LayoutAgendamento({ children }: { children: React.ReactNode }) {
  return children
}
