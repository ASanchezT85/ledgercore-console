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

export type Role = "owner" | "admin" | "operator" | "viewer" | "auditor" | "platform_operator";

export interface ConsoleUser {
  id: string;
  email: string;
  role: Role;
  status: "invited" | "active" | "disabled";
  created_at: string;
  last_login_at: string | null;
  /** The user has a confirmed authenticator (TOTP). */
  two_factor_enabled: boolean;
}

export interface SessionInfo {
  user: ConsoleUser;
  tenant: { id: string; name: string; slug: string };
  environment: "sandbox" | "live";
  /** Onboarding status of the tenant (7.4): live credentials need "approved". */
  account_status: string;
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

/** The TOTP or recovery code was wrong or already used. */
export class CodeError extends Error {
  constructor() {
    super("invalid_code");
    this.name = "CodeError";
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

// ---- Second factor (7.3, ADR-022) ------------------------------------------
//
// Between the password and the code the session is "password_verified": it
// authorizes only these calls. The CSRF token that login returned lives in
// memory, so a reloaded page asks for it again through GET auth/2fa.

export interface TwoFactorStatus {
  state: "active" | "password_verified";
  csrf_token: string;
  user: ConsoleUser;
  /** The user already has an authenticator: verify instead of enrol. */
  enabled: boolean;
  recovery_codes_remaining: number;
}

export interface Enrollment {
  /** Base32, for typing into the authenticator by hand. */
  secret: string;
  /** otpauth:// URI, rendered as a QR code. */
  otpauth_uri: string;
}

/** Session state and what the second-factor screen has to show. Throws AuthError without a live session. */
export async function twoFactorStatus(): Promise<TwoFactorStatus> {
  try {
    const st = await identityFetch<TwoFactorStatus>("GET", "auth/2fa");
    memCsrf = st.csrf_token;
    return st;
  } catch (err) {
    if (err instanceof IdentityError && err.status === 401) {
      forget();
      throw new AuthError("no_session");
    }
    throw err;
  }
}

async function twoFactorCall<T>(path: string, body?: unknown): Promise<T> {
  const csrf = memCsrf ?? (await twoFactorStatus()).csrf_token;
  try {
    return await identityFetch<T>("POST", path, body ?? {}, { csrfToken: csrf });
  } catch (err) {
    if (err instanceof IdentityError && err.status === 401) {
      // identity answers 401 both for a wrong code and for a dead session.
      if (err.message.includes("code")) throw new CodeError();
      forget();
      throw new AuthError("no_session");
    }
    throw err;
  }
}

/** The pending authenticator. Idempotent: the same secret until it is confirmed. */
export function startEnrollment(): Promise<Enrollment> {
  return twoFactorCall<Enrollment>("auth/2fa/enrollment");
}

/** Confirms the authenticator with a code, opens the session and returns the recovery codes (shown once). */
export async function confirmEnrollment(code: string): Promise<string[]> {
  const res = await twoFactorCall<{ recovery_codes: string[] }>("auth/2fa/enrollment/confirm", { code });
  memInfo = null;
  memToken = null;
  return res.recovery_codes;
}

/** Proves the second factor with a TOTP code or a recovery code; the session becomes active. */
export async function verifySecondFactor(
  input: { code: string } | { recoveryCode: string },
): Promise<void> {
  await twoFactorCall(
    "auth/2fa/verify",
    "code" in input ? { code: input.code } : { recovery_code: input.recoveryCode },
  );
  memInfo = null;
  memToken = null;
}

/** Replaces the recovery codes (needs a fresh TOTP code); returns the new ones, shown once. */
export async function regenerateRecoveryCodes(code: string): Promise<string[]> {
  const res = await twoFactorCall<{ recovery_codes: string[] }>("auth/2fa/recovery-codes", { code });
  return res.recovery_codes;
}

// ---- Step-up (7.14, ADR-030) -----------------------------------------------
//
// ledger-core answers 403 step_up_required when a console user posts at or
// above a ledger's threshold without a fresh code. A code buys a 5-minute
// token carrying step_up_at; it replaces the session token until it expires,
// so the retried write (and any other in the next minutes) goes through.

/** Proves a fresh TOTP code and switches to the elevated token. CodeError when the code is wrong or reused. */
export async function stepUp(code: string): Promise<void> {
  let res;
  try {
    res = await identityFetch<{ access_token: string; expires_in: number }>(
      "POST",
      "auth/2fa/step-up",
      { code },
      { csrf: true },
    );
  } catch (err) {
    if (err instanceof IdentityError && err.status === 401) {
      if (err.message.includes("code")) throw new CodeError();
      forget();
      throw new AuthError("no_session");
    }
    throw err;
  }
  memToken = res.access_token;
  memTokenExp = Date.now() + res.expires_in * 1000;
}

type StepUpHandler = () => Promise<boolean>;
let stepUpHandler: StepUpHandler | null = null;

/** The mounted step-up dialog registers itself here; it resolves true once the user stepped up. */
export function setStepUpHandler(h: StepUpHandler | null) {
  stepUpHandler = h;
}

/** Asks the user for a code; false when there is no dialog or they cancel. */
export function requestStepUp(): Promise<boolean> {
  return stepUpHandler ? stepUpHandler() : Promise.resolve(false);
}
