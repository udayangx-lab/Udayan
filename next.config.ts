import type { NextConfig } from 'next';
// CV uploads are limited to 5 MB and admin poster uploads to 3 MB each; this leaves room for the other fields.
const config: NextConfig = { images: { unoptimized: true }, devIndicators: false, experimental: { serverActions: { bodySizeLimit: '12mb' } } };
export default config;
