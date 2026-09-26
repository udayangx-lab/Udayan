import type { NextConfig } from 'next';
// Vercel caps request bodies at 4.5 MB. CVs are limited to 4 MB; photos upload one at a time (3 MB each).
// PGlite (local development only) ships WebAssembly and must not be bundled.
const config: NextConfig = { images: { unoptimized: true }, devIndicators: false, serverExternalPackages: ['@electric-sql/pglite'], experimental: { serverActions: { bodySizeLimit: '4.5mb' } } };
export default config;
