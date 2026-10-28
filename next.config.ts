import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  distDir: process.env.PLAYWRIGHT_LOCAL_INVOICING === "true" ? ".next/invoice-tests" : ".next",
  outputFileTracingIncludes: {
    "/api/admin/invoices/[id]/pdf": ["./public/email/sob-autofix-logo-white.png"],
    "/admin/news": ["./content/article-imports/high-intent/*.article-source"],
  },
  allowedDevOrigins: ["127.0.0.1", "exchange.localhost"],
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    inlineCss: true,
    serverActions: {
      bodySizeLimit: "36mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // Local Supabase storage, development only.
      ...(isDevelopment ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "54321" }] : []),
    ],
    dangerouslyAllowLocalIP: isDevelopment,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
