# LGPD — registro das operações e roteiro de incidentes

Documento interno da Casa de Vó Sebastiana, exigido pela LGPD (art. 37: registro das
operações; art. 48: comunicação de incidentes). Para agente de pequeno porte, a ANPD aceita
um registro simplificado (Resolução CD/ANPD nº 2/2022). Mantenha-o atualizado quando o site
mudar. Revisão feita a partir de um parecer gerado por IA em 25/11/2026 — **não substitui
advogado**; os pontos do fim deste documento devem ser validados por um profissional.

## Responsável e contato

- **Controlador:** a pessoa preenchida em "Responsável pelos dados" no painel (Informações
  da Casa). Sem CNPJ, é a pessoa natural que dirige a Casa.
- **Canal para os titulares:** o "E-mail de contato" do painel. Precisa ser uma caixa que
  alguém lê. Pedidos devem ser respondidos em até **15 dias** (art. 19).
- **Encarregado (DPO):** não indicado (agente de pequeno porte, art. 41 + Res. 2/2022),
  mantendo o canal acima. Validar com advogado por envolver dado sensível.

## Registro simplificado das operações

| Item | Conteúdo |
|---|---|
| Titulares | Pessoas que agendam atendimento ou se inscrevem em eventos; médiuns; equipe da Casa |
| Dados | Nome, telefone, e-mail, observações (texto livre), data/horário/situação do pedido, data e versão da autorização. Médiuns: nome, telefone, e-mail. Equipe: e-mail de login |
| Dado sensível | Sim: o pedido revela convicção religiosa (Umbanda); as observações podem conter dados de saúde |
| Finalidade | Organizar atendimentos e inscrições: registrar, avisar a Casa, confirmar, lembrar, avisar mudanças, mostrar o histórico |
| Base legal | Consentimento específico e destacado (art. 11, I), registrado com data e versão do texto |
| Quem acessa | Equipe da Casa (painel com login); médiuns (primeiro nome até assumir; nome, telefone e observações do próprio atendimento) |
| Operadores | Hostinger (servidor, EUA); Resend (e-mail, EUA); Google Drive (cópias de segurança criptografadas, EUA) |
| Transferência internacional | Sim (art. 33): informada na política e incluída na autorização; contratos (DPA) dos fornecedores a guardar |
| Prazos | Cadastro: 2 anos após o último atendimento (apagado pelo cron). Registros de e-mail: 90 dias. Cópias: 15 dias no servidor, 30 dias no Google Drive |
| Segurança | Painel só por link no e-mail de pessoas autorizadas; acesso ao servidor só por chave; banco não exposto à internet; cópias criptografadas antes de ir para o Drive; HTTPS; cabeçalhos de segurança |
| Exclusão | Painel → Consulentes → excluir (apaga cadastro, agendamentos e registros de e-mail; cancele antes os agendamentos futuros) |

## Roteiro de incidentes (vazamento, acesso indevido, perda de dados)

1. **Conter:** trocar senhas e chaves envolvidas (ver `docs/operacao.md`, "Trocar uma senha
   ou chave"), tirar do ar o que estiver vazando, preservar os logs.
2. **Avaliar:** que dados, de quantas pessoas, por quanto tempo, se há risco relevante (dado
   sensível costuma ter).
3. **Comunicar**, se houver risco relevante: à ANPD (gov.br/anpd → comunicação de incidente)
   e às pessoas afetadas, em até **3 dias úteis** (Resolução CD/ANPD nº 15/2024; agente de
   pequeno porte tem prazo em dobro). Dizer o que aconteceu, que dados, o que foi feito e
   como a pessoa pode se proteger.
4. **Registrar** o incidente (data, o que houve, decisões) mesmo que não precise comunicar.

**Quem faz:** o responsável pelos dados, com apoio técnico de quem mantém o site.

## Pendências do responsável

- Preencher "Responsável pelos dados" e "E-mail de contato" no painel e testar que o e-mail
  recebe mensagens.
- Ativar a verificação em duas etapas na conta Google que guarda as cópias de segurança.
- Guardar em local seguro, fora do servidor, a senha que decifra as cópias de segurança
  (sem ela, as cópias do Google Drive não podem ser restauradas).
- Guardar os contratos de tratamento de dados (DPA) da Hostinger, da Resend e do Google.

## Para validar com advogado

- Como nomear o controlador sem CNPJ (pessoa natural ou registro da Casa como organização
  religiosa, Código Civil art. 44, IV).
- Base da transferência internacional: cláusulas-padrão da Resolução CD/ANPD nº 19/2024 nos
  contratos dos fornecedores, com o consentimento como reforço.
- Enquadramento como agente de pequeno porte e dispensa de encarregado.
- Atendimento de menores (art. 14).
- Revisão final da política e da caixa de autorização.
