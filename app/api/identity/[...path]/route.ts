// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import { NextResponse } from "next/server";

// Same-origin proxy to identity's console endpoints (ADR-021).
//
// The browser never talks to identity about sessions: it calls
// /api/identity/<path> on the console's own origin, and this handler forwards
// to ${LEDGERCORE_IDENTITY_URL}/v1/<path>. That keeps the HttpOnly session
// cookie on the console origin (no credentialed CORS), and identity refuses any
// request that carries an Origin header, so this handler never forwards one.
//
// Only the routes the console uses are reachable, with the methods they take.

const ROUTES: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^auth\/login$/, methods: ["POST"] },
  { pattern: /^auth\/logout$/, methods: ["POST"] },
  { pattern: /^auth\/session$/, methods: ["GET"] },
  { pattern: /^auth\/session\/token$/, methods: ["POST"] },
  { pattern: /^auth\/invitations\/accept$/, methods: ["POST"] },
  { pattern: /^auth\/password\/(forgot|reset)$/, methods: ["POST"] },
  { pattern: /^users$/, methods: ["GET"] },
  { pattern: /^users\/invitations$/, methods: ["POST"] },
  { pattern: /^users\/[0-9a-f-]{36}$/i, methods: ["PATCH"] },
  { pattern: /^api-credentials$/, methods: ["GET", "POST"] },
  { pattern: /^api-credentials\/[0-9a-f-]{36}\/rotate$/i, methods: ["POST"] },
  { pattern: /^api-credentials\/[0-9a-f-]{36}$/i, methods: ["DELETE"] },
  { pattern: /^users\/[0-9a-f-]{36}\/2fa$/i, methods: ["DELETE"] },
  { pattern: /^auth\/2fa$/, methods: ["GET"] },
  // Onboarding (7.4): the public signup + email steps, and the session ones.
  { pattern: /^onboarding$/, methods: ["GET"] },
  { pattern: /^onboarding\/accounts$/, methods: ["POST"] },
  { pattern: /^onboarding\/(email\/(verify|resend)|phone\/(send|verify)|review)$/, methods: ["POST"] },
  { pattern: /^auth\/2fa\/(enrollment|enrollment\/confirm|verify|recovery-codes)$/, methods: ["POST"] },
];

const SESSION_COOKIE = "lc_session";

function json(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function proxy(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const rest = path.join("/");
  const route = ROUTES.find((r) => r.pattern.test(rest));
  if (!route || !route.methods.includes(request.method)) {
    return json(404, "not_found", "resource not found");
  }

  // A browser POST/PATCH/DELETE must come from this very origin (login CSRF and
  // friends); the session cookie is SameSite=Lax and writes also need the
  // CSRF header, so this is belt and braces.
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return json(403, "forbidden", "cross-origin request refused");
    }
  }

  const base = process.env.LEDGERCORE_IDENTITY_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    return json(503, "service_unavailable", "identity is not configured (LEDGERCORE_IDENTITY_URL)");
  }

  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const csrf = request.headers.get("x-csrf-token");
  if (csrf) headers.set("X-CSRF-Token", csrf);
  // Only the session cookie travels upstream.
  const cookie = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (cookie) headers.set("Cookie", cookie);
  // The client address for the login lockout (identity reads it only when
  // LEDGERCORE_TRUST_FORWARDED_FOR=true, i.e. behind the gateway).
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) headers.set("X-Forwarded-For", forwarded);

  const query = new URL(request.url).search;
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/v1/${rest}${query}`, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "DELETE" ? undefined : await request.text(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return json(502, "service_unavailable", "could not reach identity");
  }

  const out = new Headers();
  for (const name of ["content-type", "retry-after"]) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  for (const setCookie of upstream.headers.getSetCookie()) {
    out.append("set-cookie", setCookie);
  }
  out.set("cache-control", "no-store");
  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
