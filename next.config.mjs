/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        process.env.NEXT_PUBLIC_BASE_URL?.replace('https://', '').replace('http://', '') ?? '',
      ].filter(Boolean),
    },
  },
}

export default nextConfig
