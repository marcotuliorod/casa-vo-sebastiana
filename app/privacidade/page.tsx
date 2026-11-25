// Política de privacidade (LGPD): quem é o responsável, com que autorização, o que é
// coletado, para quê, quem acessa, envio ao exterior, prazos, segurança, incidentes,
// menores e direitos. Revisada a partir de um parecer (IA) em 25/11/2026; ao mudar o
// texto, atualize VERSAO_TEXTOS_LGPD e DATA_TEXTOS_LGPD em lib/consentimento.ts.
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Logo } from '@/components/shared/Logo'
import { RodapePublico } from '@/components/shared/RodapePublico'
import { emailDeContato, getInfoCasa } from '@/lib/queries/casa'
import { DATA_TEXTOS_LGPD, RETENCAO_CADASTRO_ANOS, VERSAO_TEXTOS_LGPD } from '@/lib/consentimento'

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

function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1">{children}</ul>
}

export default async function PrivacidadePage() {
  const infoCasa = await getInfoCasa()
  const contato = emailDeContato(infoCasa)
  const responsavel = infoCasa.responsavelDados

  const linkContato = contato ? (
    <a href={`mailto:${contato}`} className="text-brand-dark underline break-all">
      {contato}
    </a>
  ) : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light via-background to-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-8">
          <Logo size="sm" href="/" />
          <h1 className="mt-4 text-xl font-serif font-semibold text-brand-dark">Privacidade</h1>
          <p className="text-sm text-gray-600 mt-1">Como a Casa de Vó Sebastiana cuida dos seus dados</p>
        </div>

        <div className="space-y-8 rounded-xl border bg-white p-6">
          <Secao titulo="Quem cuida dos seus dados">
            <p>
              {responsavel ? (
                <>
                  Os dados deste site são de responsabilidade de{' '}
                  <strong className="font-semibold text-gray-900">{responsavel}</strong>, pela Casa de
                  Vó Sebastiana, que decide como eles são usados.
                </>
              ) : (
                <>Os dados deste site são de responsabilidade da direção da Casa de Vó Sebastiana, que decide como eles são usados.</>
              )}
            </p>
            <p>
              {linkContato ? (
                <>Pedidos e dúvidas sobre seus dados: {linkContato}.</>
              ) : (
                <>Pedidos e dúvidas sobre seus dados podem ser feitos pessoalmente na Casa.</>
              )}
            </p>
          </Secao>

          <Secao titulo="Com que autorização">
            <p>
              Usamos seus dados com a sua autorização, dada ao marcar a caixa no formulário de
              agendamento ou de inscrição. Como o pedido mostra que você procura atendimento
              espiritual na Umbanda, a lei trata essa informação como dado sensível. Por isso a
              autorização vale <strong>somente</strong> para organizar o seu atendimento ou inscrição:
              registrar o pedido, avisar a Casa, enviar a confirmação, o lembrete e os avisos de
              mudança, e mostrar seu histórico em &quot;Meus Agendamentos&quot;. Não usamos seus dados
              para nenhuma outra coisa.
            </p>
            <p>
              Sem essa autorização não é possível agendar pelo site, porque precisamos dos seus
              dados para isso. Você pode retirá-la a qualquer momento (veja &quot;Seus
              direitos&quot;); os atendimentos já marcados serão cancelados.
            </p>
            <p>Guardamos a data da autorização e a versão deste texto que estava publicada naquele momento.</p>
          </Secao>

          <Secao titulo="Quais dados coletamos">
            <p>Quando você agenda um atendimento ou se inscreve em um evento, guardamos:</p>
            <Lista>
              <li>nome, telefone e e-mail;</li>
              <li>as observações que você escrever no formulário (opcional);</li>
              <li>data, horário e situação de cada agendamento ou inscrição;</li>
              <li>a data e a versão do texto da autorização que você aceitou.</li>
            </Lista>
            <p>
              Não pedimos documentos, não usamos ferramentas de rastreamento ou publicidade e não
              vendemos dados a ninguém. Nas observações, escreva só o necessário: não é preciso
              contar detalhes de saúde ou da sua vida pessoal.
            </p>
          </Secao>

          <Secao titulo="Quem tem acesso">
            <Lista>
              <li>as pessoas da Casa responsáveis pela agenda, com acesso protegido por login;</li>
              <li>
                os médiuns da Casa veem a data, o horário e o seu primeiro nome nos atendimentos que
                ainda não têm médium; o médium que for atender você vê também seu nome completo,
                telefone e as observações que você escreveu;
              </li>
              <li>a empresa que hospeda o servidor do site (Hostinger), onde os dados ficam guardados;</li>
              <li>
                o serviço de envio de e-mails (Resend), que recebe seu endereço e o texto de cada
                mensagem, só para entregá-la;
              </li>
              <li>o Google Drive da Casa, onde ficam as cópias de segurança.</li>
            </Lista>
          </Secao>

          <Secao titulo="Dados enviados para fora do Brasil">
            <p>
              Alguns serviços que usamos ficam em outros países: o servidor do site (Hostinger, com
              servidor nos Estados Unidos), o envio de e-mails (Resend, nos Estados Unidos) e as
              cópias de segurança (Google Drive, nos Estados Unidos). Esses serviços só guardam ou
              entregam os dados para a Casa e não podem usá-los para outros fins. Escolhemos empresas
              que se comprometem, em contrato, a proteger dados pessoais. Ao autorizar o uso dos seus
              dados, você também concorda com esse envio.
            </p>
          </Secao>

          <Secao titulo="Por quanto tempo guardamos">
            <Lista>
              <li>
                cadastro e agendamentos: até {RETENCAO_CADASTRO_ANOS} anos depois do seu último
                atendimento ou inscrição, ou antes, se você pedir a exclusão. Depois disso, apagamos
                automaticamente;
              </li>
              <li>registros dos e-mails enviados: apagados automaticamente depois de 90 dias;</li>
              <li>
                cópias de segurança: feitas todos os dias; as do servidor são apagadas depois de 15
                dias e as do Google Drive, depois de 30 dias.
              </li>
            </Lista>
          </Secao>

          <Secao titulo="Segurança">
            <p>
              Os dados ficam em servidor com acesso protegido. Só a equipe autorizada entra no
              painel, por um link enviado ao e-mail cadastrado. Cada médium vê apenas o necessário
              para o atendimento que vai fazer. As cópias de segurança são criptografadas antes de
              irem para o Google Drive.
            </p>
          </Secao>

          <Secao titulo="Se algo der errado">
            <p>
              Se acontecer um vazamento ou acesso indevido que possa trazer risco a você, avisaremos
              você e a Autoridade Nacional de Proteção de Dados (ANPD) dentro do prazo da lei,
              explicando o que aconteceu e o que foi feito.
            </p>
          </Secao>

          <Secao titulo="Menores de idade">
            <p>
              O agendamento pelo site é para maiores de 18 anos. Para o atendimento de criança ou
              adolescente, o pedido deve ser feito pelo pai, pela mãe ou pelo responsável legal, que
              autoriza o uso dos dados em nome dele.
            </p>
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
              Pela Lei Geral de Proteção de Dados (LGPD), você pode, a qualquer momento e sem custo:
            </p>
            <Lista>
              <li>saber se temos dados seus e ver quais são;</li>
              <li>corrigir dados errados ou desatualizados;</li>
              <li>pedir uma cópia dos seus dados;</li>
              <li>saber com quem eles são compartilhados;</li>
              <li>retirar a autorização e pedir que tudo seja apagado.</li>
            </Lista>
            <p>
              Ao apagar, removemos seu cadastro, todo o histórico de agendamentos e os registros dos
              e-mails enviados a você. Se houver atendimento marcado, ele será cancelado antes. As
              cópias de segurança feitas antes do pedido somem sozinhas em até 30 dias.
            </p>
            <p>
              {linkContato ? (
                <>Para fazer o pedido, escreva para {linkContato}.</>
              ) : (
                <>Para fazer o pedido, fale com a Casa pessoalmente.</>
              )}{' '}
              Respondemos em até 15 dias. Se não ficar satisfeito, você pode reclamar à Autoridade
              Nacional de Proteção de Dados (ANPD), em{' '}
              <a
                href="https://www.gov.br/anpd"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-dark underline"
              >
                gov.br/anpd
              </a>
              .
            </p>
          </Secao>

          <p className="border-t pt-4 text-xs text-gray-600">
            Versão {VERSAO_TEXTOS_LGPD}, de {format(parseISO(DATA_TEXTOS_LGPD), 'dd/MM/yyyy')}. Se
            mudarmos algo importante, avisaremos aqui e, quando a mudança afetar a autorização que
            você deu, pediremos de novo.
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-block py-2 text-sm text-brand-dark underline underline-offset-2">
            ← Voltar ao início
          </Link>
        </div>
        <RodapePublico />
      </div>
    </div>
  )
}
