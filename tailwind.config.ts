import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Design system oficial — Casa de Vó Sebastiana
        brand: {
          DEFAULT: '#4A86C8',      // Azul Sereno acessível — botões primários
          light: '#EEF5FB',        // Fundo azul muito claro — hover, backgrounds
          muted: '#A7C7E7',        // Azul Sereno — bordas, acentos, focus ring
          dark: '#1A4A7C',         // Azul escuro — títulos e texto de destaque
          hover: '#3A72B0',        // Azul escuro — hover dos botões primários
          areia: '#E8D8C3',        // Areia Sagrada — backgrounds secundários
          'areia-light': '#F5EDE2', // Areia clara — hover sobre areia
          gold: '#D6B36A',         // Dourado sutil — acentos especiais
          green: '#B7D3C0',        // Verde folha suave — sucesso/cura
          success: '#7BC47F',      // Verde sucesso
          error: '#E57373',        // Vermelho erro
          warning: '#F2C94C',      // Amarelo alerta
        },
        // Paleta original do logo (mantido para referência)
        marca: {
          azul: '#A7C7E7',
          areia: '#E8D8C3',
          dourado: '#D6B36A',
          marinho: '#1A4A7C',
          branco: '#FAFAFA',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
