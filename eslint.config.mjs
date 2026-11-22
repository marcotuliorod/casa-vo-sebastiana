// ESLint 9 (flat config). O `next lint` foi removido no Next 16; o lint roda
// direto pelo ESLint com a config oficial do Next.
import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  {
    rules: {
      // Regra nova do eslint-plugin-react-hooks 7 (Next 16). Os formulários do
      // admin fecham o modo de edição num useEffect após a action dar certo
      // (padrão anterior à migração). Fica como aviso até esse fluxo ser
      // reescrito sem effect; não é bug funcional.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'load-tests/**', 'next-env.d.ts'],
  },
]

export default config
