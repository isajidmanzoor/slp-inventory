/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'smartlivingpakistan.com',
      },
    ],
  },
};

module.exports = nextConfig;