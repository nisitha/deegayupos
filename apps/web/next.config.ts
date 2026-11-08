import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pixelcraft/types', '@pixelcraft/validation'],
};

export default nextConfig;
