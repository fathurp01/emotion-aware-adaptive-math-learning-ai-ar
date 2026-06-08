/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable instrumentation for startup checks
  experimental: {
    instrumentationHook: true,
  },
  images: {
    domains: ['localhost', 'media.node-f3a17c.my.id'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config) => {
    // Fix for Teachable Machine and TensorFlow.js in Next.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://localhost:5000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
