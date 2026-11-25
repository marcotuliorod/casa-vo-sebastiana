# Instruções para o Claude

## Fluxo de trabalho
- O dono do projeto não executa tarefas técnicas. Faça sempre o fluxo do git completo, sem pedir
  que ele rode comandos ou clique em nada no GitHub:
  branch → commit → push → PR → acompanhar o CI → corrigir o que falhar → marcar como pronto → merge.
- Só faça o merge com o CI verde e sem conflitos. Use merge commit (padrão do repositório).
- Antes do push, rode `npm run type-check`, `npm run lint` e `npm test`.
- Comunicação em português, sem jargão técnico desnecessário.
