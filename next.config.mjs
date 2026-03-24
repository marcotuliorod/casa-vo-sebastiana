/** @type {import('next').NextConfig} */
const nextConfig = {
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
