// Política de privacidade (LGPD): o que o site coleta, para quê, com quem
// compartilha, por quanto tempo guarda e como pedir acesso, correção ou exclusão.
import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { emailDeContato, getInfoCasa } from '@/lib/queries/casa'

export const metadata = {
  title: 'Privacidade',
}

// Lê o responsável e o contato (tela "Informações da Casa") em cada requisição, não no build
export const dynamic = 'force-dynamic'

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-lg font-semibold text-brand-dark">{titulo}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  )
}

export default async function PrivacidadePage() {
  const infoCasa = await getInfoCasa()
  const contato = emailDeContato(infoCasa)

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-8">
          <Logo size="sm" href="/" />
          <h1 className="mt-4 text-xl font-serif font-semibold text-brand-dark">Privacidade</h1>
          <p className="text-sm text-gray-500 mt-1">Como a Casa de Vó Sebastiana cuida dos seus dados</p>
        </div>

        <div className="space-y-8 rounded-xl border bg-white p-6">
          {infoCasa.responsavelDados && (
            <Secao titulo="Quem cuida dos seus dados">
              <p>
                Os dados deste site são de responsabilidade de{' '}
                <strong className="font-semibold text-gray-900">{infoCasa.responsavelDados}</strong>.
              </p>
            </Secao>
          )}

          <Secao titulo="Quais dados coletamos">
            <p>Quando você agenda um atendimento ou se inscreve em um evento, guardamos:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>nome, telefone e e-mail;</li>
              <li>as observações que você escrever no formulário (opcional);</li>
              <li>data, horário e situação de cada agendamento ou inscrição.</li>
            </ul>
            <p>
              Não pedimos documentos, não usamos ferramentas de rastreamento ou publicidade e não
              vendemos dados a ninguém.
            </p>
          </Secao>

          <Secao titulo="Para que usamos">
            <ul className="list-disc pl-5 space-y-1">
              <li>organizar a agenda da Casa e evitar horários duplicados;</li>
              <li>
                enviar por e-mail o recebimento do pedido, a confirmação da Casa, o lembrete antes da
                data e avisos de alteração ou cancelamento;
              </li>
              <li>mostrar o seu histórico em &quot;Meus Agendamentos&quot;, por um link enviado só ao seu e-mail.</li>
            </ul>
            <p>
              Usamos os dados apenas para o atendimento que você pediu. O telefone serve para
              identificar seu cadastro e, se preciso, para a Casa falar com você.
            </p>
          </Secao>

          <Secao titulo="Com que autorização">
            <p>
              Usamos seus dados com a sua autorização, dada ao marcar a caixa no formulário de
              agendamento ou de inscrição. Como o pedido mostra que você procura atendimento
              espiritual na Umbanda, a lei trata essa informação como dado sensível; por isso a
              autorização é específica para organizar o seu atendimento, e guardamos a data em que
              ela foi dada.
            </p>
            <p>
              Você pode retirar a autorização a qualquer momento pedindo a exclusão dos seus dados
              (veja &quot;Seus direitos&quot;).
            </p>
          </Secao>

          <Secao titulo="Quem tem acesso">
            <ul className="list-disc pl-5 space-y-1">
              <li>as pessoas da Casa responsáveis pela agenda, com acesso protegido por login;</li>
              <li>
                os médiuns da Casa veem a data, o horário e o seu primeiro nome nos atendimentos que
                ainda não têm médium; o médium que for atender você vê também seu nome completo,
                telefone e as observações que você escreveu;
              </li>
              <li>
                o serviço de envio de e-mails que usamos (Resend) recebe seu endereço e o texto de
                cada mensagem, só para entregá-la;
              </li>
              <li>
                as cópias de segurança do sistema são guardadas também no Google Drive da Casa, só
                para recuperar os dados em caso de falha do servidor.
              </li>
            </ul>
          </Secao>

          <Secao titulo="Por quanto tempo guardamos">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                cadastro e agendamentos: enquanto forem úteis para os seus atendimentos, ou até você
                pedir a exclusão;
              </li>
              <li>registros dos e-mails enviados: apagados automaticamente depois de 90 dias;</li>
              <li>
                cópias de segurança: feitas todos os dias; as do servidor são apagadas depois de 15
                dias e as do Google Drive, depois de 30 dias.
              </li>
            </ul>
          </Secao>

          <Secao titulo="Cookies">
            <p>
              O site não usa cookies de rastreamento. Usamos apenas cookies necessários: um que
              mantém aberto o seu histórico depois que você clica no link do e-mail (vale por 1 hora
              e some ao clicar em &quot;Sair&quot;) e o de login da equipe da Casa.
            </p>
          </Secao>

          <Secao titulo="Seus direitos">
            <p>
              Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir a qualquer momento para
              ver, corrigir ou apagar seus dados, ou retirar a autorização. Ao apagar, removemos seu
              cadastro, todo o histórico de agendamentos e os registros dos e-mails enviados a você.
              As cópias de segurança feitas antes do pedido somem sozinhas em até 30 dias.
            </p>
            <p>
              {contato ? (
                <>
                  Para fazer o pedido, escreva para{' '}
                  <a href={`mailto:${contato}`} className="text-brand hover:underline break-all">
                    {contato}
                  </a>
                  .
                </>
              ) : (
                <>Para fazer o pedido, responda qualquer e-mail que você recebeu da Casa.</>
              )}
            </p>
          </Secao>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-brand hover:underline">
            ← Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  )
}
