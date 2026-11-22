// CSP em modo Report-Only: o navegador só reporta violações no console, sem
// bloquear nada. 'unsafe-inline' em script-src é necessário no Next 14 sem nonce.
// Depois de alguns dias sem violações, trocar a chave para Content-Security-Policy.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle mínimo para a imagem Docker (self-hosted, sem Vercel)
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Só em produção: o dev server do Next usa eval e quebraria a política
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Content-Security-Policy-Report-Only', value: csp }]
            : []),
        ],
      },
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        process.env.NEXT_PUBLIC_BASE_URL?.replace('https://', '').replace('http://', '') ?? '',
      ].filter(Boolean),
    },
    // Desabilita o Router Cache (client-side) para páginas dinâmicas.
    // Sem isso, Next.js 14 mantém o HTML renderizado em memória por 30s,
    // fazendo a navegação por Link servir dados desatualizados até um hard refresh.
    staleTimes: {
      dynamic: 0,
    },
  },
}

export default nextConfig
