// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { NextConfig } from "next";

// The browser talks to the gateway directly (NEXT_PUBLIC_API_URL is baked at
// build time), so that origin is the only extra connect-src.
function apiOrigin(): string {
  try {
    return process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : "";
  } catch {
    return "";
  }
}

// 7.10 security headers. Next.js injects inline bootstrap scripts, so
// script-src keeps 'unsafe-inline' (a per-request nonce would force every page
// dynamic); everything else is closed: no framing, no plugins, no foreign
// base/form targets. Dev needs 'unsafe-eval' for React's debugging tooling.
function securityHeaders() {
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin()}${dev ? " ws:" : ""}`.trim(),
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
}

const nextConfig: NextConfig = {
  // Standalone output so the Docker image only ships the compiled server;
  // Vercel (VERCEL=1 at build) packages the app itself and rejects it.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
