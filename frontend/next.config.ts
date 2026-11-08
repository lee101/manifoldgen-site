import type { NextConfig } from 'next';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Static export embeds the build id in every page. Next's default is random, which
// made all ~30k pages differ on every deploy (so every file was re-uploaded to R2).
// Derive it from the build inputs instead: a server-only deploy yields byte-identical
// pages and the deploy uploads nothing for the frontend.
function sourceBuildId(): string {
  const hash = createHash('sha1');
  const walk = (path: string) => {
    if (!existsSync(path)) return;
    if (statSync(path).isFile()) {
      hash.update(path).update(readFileSync(path));
      return;
    }
    for (const name of readdirSync(path).sort()) walk(join(path, name));
  };
  for (const entry of ['app', 'components', 'lib', 'public', 'scripts', 'translations',
    'package.json', 'bun.lock', 'next.config.ts', 'tsconfig.json']) walk(entry);
  return hash.digest('hex').slice(0, 20);
}

const isExport = process.env.NEXT_OUTPUT === 'export';
const apiOrigin = process.env.MANIFOLDGEN_API_ORIGIN || 'http://localhost:8116';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  ...(isExport ? { generateBuildId: async () => sourceBuildId() } : {}),
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
    inlineCss: true,
  },
  ...(isExport
    ? {}
    : {
        async rewrites() {
          return [
            { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
            { source: '/images/:path*', destination: `${apiOrigin}/images/:path*` },
            { source: '/pose-assets/:path*', destination: `${apiOrigin}/pose-assets/:path*` },
          ];
        },
      }),
};

export default nextConfig;
