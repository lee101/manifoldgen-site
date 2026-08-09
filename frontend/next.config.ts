import type { NextConfig } from 'next';

const isExport = process.env.NEXT_OUTPUT === 'export';
const apiOrigin = process.env.MANIFOLDGEN_API_ORIGIN || 'http://localhost:8116';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: {
    ...(isExport ? { unoptimized: true } : {}),
  },
  output: isExport ? 'export' : 'standalone',
  compress: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  ...(isExport
    ? {}
    : {
        async rewrites() {
          return [
            { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
            { source: '/images/:path*', destination: `${apiOrigin}/images/:path*` },
          ];
        },
      }),
};

export default nextConfig;
