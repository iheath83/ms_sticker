import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone builds (single self-contained output)
  output: "standalone",

  // Static asset caching — CSP and security headers handled by middleware at runtime
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // Image optimisation — allow Scaleway + MinIO origins
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s3.fr-par.scw.cloud" },
      { protocol: "https", hostname: "*.scw.cloud" },
      { protocol: "http",  hostname: "localhost" },
      { protocol: "http",  hostname: "54.38.37.66" },
    ],
  },

  // Reduce Docker image size — exclude source maps in prod
  productionBrowserSourceMaps: false,

  // TypeScript: fail build on errors
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
