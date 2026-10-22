// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MailPlus, ShieldOff, UserCheck, UserX } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { ErrorBanner, LoadingCard } from "@/components/live";
import { RecoveryCodes } from "@/components/recovery-codes";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  AuthError,
  CodeError,
  hasSession,
  IdentityError,
  identityFetch,
  getSessionInfo,
  LockedError,
  logout,
  regenerateRecoveryCodes,
  twoFactorStatus,
  type ConsoleUser,
  type Role,
  type SessionInfo,
} from "@/lib/session";

const ROLES: Role[] = ["owner", "admin", "operator", "viewer", "auditor"];

const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including managing admins and owners",
  admin: "Read and write on all services; manages operators, viewers and auditors",
  operator: "Read and write ledger and reconciliation; reads webhooks",
  viewer: "Reads ledger and reconciliation",
  auditor: "Reads ledger, reconciliation and webhooks",
  platform_operator: "LedgerCore staff (back office); never assigned from a tenant",
};

const STATUS_TONE: Record<ConsoleUser["status"], BadgeTone> = {
  active: "emerald",
  invited: "amber",
  disabled: "slate",
};

/** Roles the signed-in user may hand out (mirrors identity's rule). */
function assignable(actor: Role): Role[] {
  if (actor === "owner") return ROLES;
  if (actor === "admin") return ["operator", "viewer", "auditor"];
  return [];
}

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "never";
}

/** Your own authenticator: how many recovery codes are left, and a way to replace them. */
function SecurityCard() {
  const [left, setLeft] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    twoFactorStatus()
      .then((st) => setLeft(st.recovery_codes_remaining))
      .catch(() => setLeft(null));
  }, []);

  async function regenerate(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await regenerateRecoveryCodes(code.trim());
      setCodes(fresh);
      setLeft(fresh.length);
      setAsking(false);
      setCode("");
    } catch (err) {
      if (err instanceof CodeError) setError("Wrong or already used code. Wait for the next one in your app.");
      else if (err instanceof LockedError) setError(`Too many attempts. Try again in ${err.retryAfter} s.`);
      else setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Your two-factor authentication" subtitle="Authenticator app (TOTP) with recovery codes">
      <p className="text-sm text-ink-muted">
        {left === null ? "Two-factor authentication is on for your account." : `${left} recovery code${left === 1 ? "" : "s"} left.`}{" "}
        Each recovery code works once, if you lose your phone.
      </p>
      {codes && (
        <div className="mt-3 max-w-md">
          <p className="mb-2 text-xs text-ink">
            New recovery codes. The old ones no longer work, and these are shown only now.
          </p>
          <RecoveryCodes codes={codes} copyLabel="Copy all" copiedLabel="Copied" />
        </div>
      )}
      {asking ? (
        <form onSubmit={regenerate} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Code from your app</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              placeholder="123456"
              className="h-10 w-36 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 font-mono text-sm tracking-widest text-ink"
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={busy || code.replace(/\D/g, "").length < 6}
            className="inline-flex h-10 items-center rounded-(--radius-control) bg-accent-deep px-4 text-sm font-semibold text-on-accent hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate new codes
          </button>
          {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAsking(true);
            setCodes(null);
            setError(null);
          }}
          className="mt-3 text-xs text-accent hover:underline"
        >
          Generate new recovery codes
        </button>
      )}
    </Card>
  );
}

function LiveUsers() {
  const router = useRouter();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [users, setUsers] = useState<ConsoleUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);

  const handle = useCallback(
    async (err: unknown) => {
      if (err instanceof AuthError) {
        await logout();
        router.replace("/login?reason=expired");
        return;
      }
      setError(err instanceof Error ? err.message : "unknown_error");
    },
    [router],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await getSessionInfo(true);
      if (!me) throw new AuthError("no_session");
      setInfo(me);
      if (assignable(me.user.role).length === 0) {
        setUsers([]);
        return;
      }
      const res = await identityFetch<{ data: ConsoleUser[] }>("GET", "users");
      setUsers(res.data);
    } catch (err) {
      await handle(err);
    }
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, done: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      await load();
      return true;
    } catch (err) {
      if (err instanceof IdentityError) setError(err.message);
      else await handle(err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!info || users === null) {
    return error ? <ErrorBanner message={error} onRetry={() => void load()} /> : <LoadingCard />;
  }

  const mine = assignable(info.user.role);
  if (mine.length === 0) {
    return (
      <>
        <Card title="Users" subtitle="Only owners and admins manage users">
          <p className="text-sm text-ink-muted">
            You are signed in as <strong className="text-ink">{info.user.email}</strong> with
            the <Badge tone="slate">{info.user.role}</Badge> role: {ROLE_HELP[info.user.role]}.
            Ask an owner or admin of <strong className="text-ink">{info.tenant.name}</strong> to
            change your role.
          </p>
        </Card>
        <SecurityCard />
      </>
    );
  }

  const canTouch = (u: ConsoleUser) => mine.includes(u.role) && u.id !== info.user.id;

  return (
    <>
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {notice && (
        <p role="status" className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-2 text-xs text-ink">
          {notice}
        </p>
      )}

      <Card
        title="Invite someone"
        subtitle="They get an email with a one-time link (valid 7 days) to choose their password"
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              () => identityFetch("POST", "users/invitations", { email: email.trim(), role }, { csrf: true }),
              `Invitation sent to ${email.trim()}.`,
            ).then((ok) => ok && setEmail(""));
          }}
        >
          <label className="block min-w-64 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="h-10 w-full rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent/60"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-10 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink"
              aria-label="Role of the invited user"
            >
              {mine.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-accent-deep px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MailPlus size={15} aria-hidden="true" />
            Send invitation
          </button>
        </form>
        <p className="mt-3 text-xs text-ink-faint">{ROLE_HELP[role]}.</p>
      </Card>

      <Card title="Team" subtitle={`${users.length} user${users.length === 1 ? "" : "s"} in ${info.tenant.name}`} flush>
        <Table>
          <THead>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH>2FA</TH>
            <TH>Last sign-in</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="text-ink">
                  {u.email}
                  {u.id === info.user.id && <span className="ml-2 text-[10px] text-ink-faint">(you)</span>}
                </TD>
                <TD>
                  {canTouch(u) && u.status !== "disabled" ? (
                    <select
                      value={u.role}
                      disabled={busy}
                      aria-label={`Role of ${u.email}`}
                      onChange={(e) =>
                        void act(
                          () => identityFetch("PATCH", `users/${u.id}`, { role: e.target.value }, { csrf: true }),
                          `${u.email} is now ${e.target.value}.`,
                        )
                      }
                      className="h-8 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-2 text-xs text-ink"
                    >
                      {mine.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone="slate">{u.role}</Badge>
                  )}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[u.status]} dot>
                    {u.status}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone={u.two_factor_enabled ? "emerald" : "slate"}>
                    {u.two_factor_enabled ? "on" : "off"}
                  </Badge>
                </TD>
                <TD className="text-xs whitespace-nowrap">{formatWhen(u.last_login_at)}</TD>
                <TD className="space-x-3 text-right">
                  {canTouch(u) && u.two_factor_enabled && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Reset two-factor for ${u.email}? Their sessions end now and they must set up the authenticator again at the next sign-in.`,
                          )
                        )
                          return;
                        void act(
                          () => identityFetch("DELETE", `users/${u.id}/2fa`, undefined, { csrf: true }),
                          `Two-factor reset for ${u.email}.`,
                        );
                      }}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      <ShieldOff size={13} aria-hidden="true" /> Reset 2FA
                    </button>
                  )}
                  {canTouch(u) &&
                    (u.status === "disabled" ? (
                      u.last_login_at !== null && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () => identityFetch("PATCH", `users/${u.id}`, { status: "active" }, { csrf: true }),
                              `${u.email} is active again.`,
                            )
                          }
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
                        >
                          <UserCheck size={13} aria-hidden="true" /> Enable
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Disable ${u.email}? Their sessions end immediately.`)) return;
                          void act(
                            () => identityFetch("PATCH", `users/${u.id}`, { status: "disabled" }, { csrf: true }),
                            `${u.email} is disabled.`,
                          );
                        }}
                        className="inline-flex items-center gap-1 text-xs text-danger hover:underline disabled:opacity-50"
                      >
                        <UserX size={13} aria-hidden="true" /> {u.status === "invited" ? "Cancel invite" : "Disable"}
                      </button>
                    ))}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <SecurityCard />
    </>
  );
}

export function UsersView() {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    setLive(hasSession());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">Users</h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            People who sign in to this tenant&apos;s console, and what each role may do
          </p>
        </div>
        <DemoBadge demo={live === false} />
      </div>
      {live === true && <LiveUsers />}
      {live === false && (
        <Card title="Users" subtitle="Demo mode">
          <p className="text-sm text-ink-muted">
            User management needs a real session. Sign in with your email and password to
            invite people and manage their roles.
          </p>
        </Card>
      )}
    </div>
  );
}
