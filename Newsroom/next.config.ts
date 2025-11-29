
import type {NextConfig} from 'next';

const resolvedAssetPrefix = process.env.NEXT_PUBLIC_NEWSROOM_ASSET_PREFIX?.replace(/\/$/, '');

const nextConfig: NextConfig = {
  assetPrefix: resolvedAssetPrefix || undefined,
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
       {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  env: {
    DIFFBOT_TOKEN: process.env.DIFFBOT_TOKEN,
    SERPAPI_KEY: process.env.SERPAPI_KEY,
    LOOPS_API_KEY: process.env.LOOPS_API_KEY,
    PRODUCT_HUNT_API_KEY: process.env.PRODUCT_HUNT_API_KEY,
    PRODUCT_HUNT_API_SECRET: process.env.PRODUCT_HUNT_API_SECRET,
  }
};

export default nextConfig;
