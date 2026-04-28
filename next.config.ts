import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone builds (single self-contained output)
  output: "standalone",

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "connect-src 'self' https://api.stripe.com https://api.brevo.com",
              "img-src 'self' data: blob: https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
            ].join("; "),
          },
        ],
      },
      // Admin routes must not be indexed by search engines
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      // Cache static assets aggressively — production only
      // (applying in dev breaks Turbopack chunk revalidation)
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/static/(.*)",
              headers: [
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
              ],
            },
          ]
        : []),
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
