import { Carregando } from '@/components/shared/Carregando'

export default function CarregandoAgendamento() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background">
      <Carregando texto="Carregando seu agendamento..." />
    </div>
  )
}
