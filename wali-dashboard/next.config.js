/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/dash',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}
module.exports = nextConfig
