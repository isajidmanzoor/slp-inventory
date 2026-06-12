/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'smartlivingpakistan.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ]
  }
}
module.exports = nextConfig
