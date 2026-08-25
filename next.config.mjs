/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle mínimo para a imagem Docker (self-hosted, sem Vercel)
  output: 'standalone',
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
