import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const securityHeaders = [
  // Prevent clickjacking — only allow same-origin framing
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Block MIME-type sniffing (e.g. serving uploaded .txt as HTML)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control Referer header leakage
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Enforce HTTPS in browsers that support HSTS (1 year, include subdomains)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Opt out of Google FLoC / Topics
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Prevent cross-origin resource attacks
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: "20mb",
    optimizePackageImports: ["lucide-react"],
  },
};

export default withBundleAnalyzer(nextConfig);
