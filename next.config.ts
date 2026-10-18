// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: Apache-2.0

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output so the Docker image only ships the compiled server.
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
