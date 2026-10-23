// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

// Who the browser is, for the console's server-side calls to the backend.
// X-Forwarded-For serves a console next to identity (compose); from any other
// host (Vercel) the gateway strips it, so the address also travels in
// X-Ledgercore-Client-Ip next to the shared LEDGERCORE_CONSOLE_TOKEN: identity
// believes it only with that secret, and the gateway rate-limits console
// traffic per browser on it instead of per console server.
export function clientHeaders(request: Request): Record<string, string> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return {};
  const out: Record<string, string> = { "X-Forwarded-For": ip };
  const token = process.env.LEDGERCORE_CONSOLE_TOKEN;
  if (token) {
    out["X-Ledgercore-Console-Token"] = token;
    out["X-Ledgercore-Client-Ip"] = ip;
  }
  return out;
}
