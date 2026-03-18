/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aqua-accessible-gull-849.mypinata.cloud',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
    ],
  },
  transpilePackages: ['territory-nft-shared'],
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding')

    // Prevent WalletConnect/RainbowKit from being bundled server-side
    if (isServer) {
      config.externals.push(
        '@walletconnect/universal-provider',
        '@walletconnect/ethereum-provider',
        'idb-keyval'
      )
    }

    return config
  },
  experimental: {
    // tell Next.js not to call npm for workspace resolution
    externalDir: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
