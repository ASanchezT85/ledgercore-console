// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Client-side session for the console.
 *
 * People sign in with email + password (ADR-021). The server (identity) opens
 * a session and sets an HttpOnly cookie on the CONSOLE origin through the
 * /api/identity proxy; JavaScript never sees it. What lives here:
 *
 *  - the CSRF token of the session, in memory only;
 *  - the 15-minute access JWT the console uses against the other services,
 *    in memory only, minted by POST /v1/auth/session/token and renewed when it
 *    is about to expire;
 *  - a non-secret "signed in" hint in localStorage so the synchronous
 *    `hasSession()` can tell a real session from demo mode. The cookie is the
 *    truth: a stale hint just produces a 401, which clears it.
 *
 * API keys are for integrations and are never stored by the console.
 */

const HINT_KEY = "lc_signed_in";

/** Milliseconds of remaining validity below which we mint a new JWT. */
const REFRESH_SKEW_MS = 60_000;

let memToken: string | null = null;
let memTokenExp = 0;
let memCsrf: string | null = null;
let memInfo: SessionInfo | null = null;

export interface SessionClaims {
  tenantId: string;
  env: "sandbox" | "live" | string;
  scopes: string[];
  keyId: string;
  exp: number;
}

export type Role = "owner" | "admin" | "operator" | "viewer" | "auditor";

export interface ConsoleUser {
  id: string;
  email: string;
  role: Role;
  status: "invited" | "active" | "disabled";
  created_at: string;
  last_login_at: string | null;
}

export interface SessionInfo {
  user: ConsoleUser;
  tenant: { id: string; name: string; slug: string };
  environment: "sandbox" | "live";
  scopes: string[];
  csrf_token: string;
  expires_at: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Too many login attempts: wait `retryAfter` seconds. */
export class LockedError extends Error {
  constructor(public retryAfter: number) {
    super("locked");
    this.name = "LockedError";
  }
}

/** An error answer of the identity API (status + its message). */
export class IdentityError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

function hint(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function setHint(on: boolean) {
  const s = hint();
  if (!s) return;
  try {
    if (on) s.setItem(HINT_KEY, "1");
    else s.removeItem(HINT_KEY);
  } catch {
    /* storage blocked: demo mode detection degrades, nothing else */
  }
}

function forget() {
  memToken = null;
  memTokenExp = 0;
  memCsrf = null;
  memInfo = null;
  setHint(false);
}

/** Whether a real (non-demo) session probably exists on this device. */
export function hasSession(): boolean {
  try {
    return hint()?.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Base64url-decode the JWT payload. Returns null on any malformed input. */
export function decodeClaims(token: string): SessionClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as Record<string, unknown>;
    return {
      tenantId: String(json.tenant_id ?? ""),
      env: String(json.env ?? "sandbox"),
      scopes: Array.isArray(json.scopes) ? json.scopes.map(String) : [],
      keyId: String(json.sub ?? ""),
      exp: Number(json.exp ?? 0),
    };
  } catch {
    return null;
  }
}

// ---- Identity API (through the console's same-origin proxy) ----------------

/**
 * Calls the identity API via /api/identity. `path` is the part after /v1/
 * (e.g. "auth/login", "users"). `csrf` adds the session's CSRF header.
 * Returns the parsed JSON body (undefined for 204). Throws IdentityError for
 * any non-2xx answer, LockedError on 429 and Error("network") when the
 * console server cannot be reached.
 */
export async function identityFetch<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts: { csrf?: boolean; csrfToken?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.csrfToken) {
    headers["X-CSRF-Token"] = opts.csrfToken;
  } else if (opts.csrf) {
    headers["X-CSRF-Token"] = await ensureCsrf();
  }
  let res: Response;
  try {
    res = await fetch(`/api/identity/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error("network");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    /* not JSON */
  }
  if (res.ok) return data as T;
  if (res.status === 429) {
    throw new LockedError(Number(res.headers.get("Retry-After") ?? "60") || 60);
  }
  const message =
    (data as { error?: { message?: string } } | undefined)?.error?.message ??
    `request failed (${res.status})`;
  throw new IdentityError(res.status, message);
}

async function ensureCsrf(): Promise<string> {
  if (memCsrf) return memCsrf;
  const info = await loadSession();
  return info.csrf_token;
}

async function loadSession(): Promise<SessionInfo> {
  try {
    const info = await identityFetch<SessionInfo>("GET", "auth/session");
    memInfo = info;
    memCsrf = info.csrf_token;
    return info;
  } catch (err) {
    if (err instanceof IdentityError && err.status === 401) {
      forget();
      throw new AuthError("no_session");
    }
    throw err;
  }
}

/** The signed-in user, tenant and role (cached; refreshed on demand). */
export async function getSessionInfo(refresh = false): Promise<SessionInfo | null> {
  if (!hasSession()) return null;
  try {
    return !refresh && memInfo ? memInfo : await loadSession();
  } catch {
    return null;
  }
}

/**
 * Signs in. Resolves to the session state ("active", or "password_verified"
 * while a second factor is pending). Throws AuthError (wrong email or
 * password), LockedError (wait `retryAfter` seconds) or Error("network").
 */
export async function login(email: string, password: string): Promise<string> {
  try {
    const res = await identityFetch<{ csrf_token: string; state: string }>(
      "POST",
      "auth/login",
      { email: email.trim(), password },
    );
    memCsrf = res.csrf_token;
    memInfo = null;
    memToken = null;
    setHint(true);
    return res.state;
  } catch (err) {
    if (err instanceof IdentityError && err.status === 401) {
      throw new AuthError("invalid_credentials");
    }
    throw err;
  }
}

/**
 * Ends the session. Local state is forgotten at once (callers redirect right
 * after); the server is told on a best-effort basis (the cookie may already be dead).
 */
export async function logout(): Promise<void> {
  if (!hasSession()) {
    forget();
    return;
  }
  let csrf = memCsrf;
  if (!csrf) {
    try {
      csrf = (await loadSession()).csrf_token;
    } catch {
      /* no live session on the server either */
    }
  }
  forget();
  if (!csrf) return;
  try {
    await identityFetch("POST", "auth/logout", undefined, { csrfToken: csrf });
  } catch {
    /* nothing more to do */
  }
}

/**
 * Returns a valid access token, minting a new one from the session when the
 * current one is missing or about to expire. Throws AuthError when there is
 * no live session.
 */
export async function getAccessToken(): Promise<string> {
  if (memToken && Date.now() < memTokenExp - REFRESH_SKEW_MS) return memToken;
  if (!hasSession()) throw new AuthError("no_session");
  const mint = () =>
    identityFetch<{ access_token: string; expires_in: number }>(
      "POST",
      "auth/session/token",
      undefined,
      { csrf: true },
    );
  let res;
  try {
    try {
      res = await mint();
    } catch (err) {
      // A stale CSRF token (identity restarted, session replaced): refetch once.
      if (err instanceof IdentityError && err.status === 403) {
        memCsrf = null;
        res = await mint();
      } else {
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof IdentityError && (err.status === 401 || err.status === 403)) {
      forget();
      throw new AuthError("no_session");
    }
    if (err instanceof AuthError) throw err;
    throw err;
  }
  memToken = res.access_token;
  memTokenExp = Date.now() + res.expires_in * 1000;
  return memToken;
}

/** Claims of the current session token, if any. */
export async function sessionClaims(): Promise<SessionClaims | null> {
  if (!hasSession()) return null;
  try {
    return decodeClaims(await getAccessToken());
  } catch {
    return null;
  }
}
