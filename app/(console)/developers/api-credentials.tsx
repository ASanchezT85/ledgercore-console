// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { ErrorBanner, LoadingCard } from "@/components/live";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  AuthError,
  IdentityError,
  identityFetch,
  logout,
  type SessionInfo,
} from "@/lib/session";

// Wire types of the identity API (contracts/openapi/identity.v1.yaml, ApiCredentials).
interface ApiCredential {
  id: string;
  environment: "sandbox" | "live";
  name: string;
  api_key: string;
  scopes: string[];
  /** IP allow-list (IPv4/IPv6 addresses or CIDRs); empty means any address. */
  allowed_cidrs: string[];
  ip_mode: "observe" | "enforce";
  status: "active" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  rotated_to: string | null;
}

/** An address seen outside a credential's allow-list. */
interface IpEvent {
  ip: string;
  outcome: "observed" | "rejected";
  hits: number;
  first_seen_at: string;
  last_seen_at: string;
}

/** One address or CIDR per line (commas and spaces work too). */
function parseCidrs(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Create / rotate answer: the only time the secret is ever returned. */
type IssuedCredential = ApiCredential & { api_secret: string };

interface Issued {
  kind: "created" | "rotated";
  credential: IssuedCredential;
  /** Rotation only: when the previous pair stops working (ISO). */
  overlapEnds?: string;
}

const SCOPES: { value: string; help: string }[] = [
  { value: "ledger:read", help: "Read ledgers, accounts, balances and transactions" },
  { value: "ledger:write", help: "Create accounts and post transactions" },
  { value: "reconciliation:read", help: "Read reconciliation runs and discrepancies" },
  { value: "reconciliation:write", help: "Import statements and resolve discrepancies" },
  { value: "webhooks:read", help: "Read webhook subscriptions and deliveries" },
  { value: "webhooks:write", help: "Create and manage webhook subscriptions" },
];

const DANGEROUS_SCOPE = "ledger:frozen_override";

const STATUS_TONE: Record<ApiCredential["status"], BadgeTone> = {
  active: "emerald",
  expired: "amber",
  revoked: "red",
};

const INPUT =
  "h-10 w-full rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent/60";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {
            /* clipboard blocked: the value is selectable on screen */
          },
        );
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-edge-strong px-2 py-1 text-[11px] font-medium text-ink-muted hover:text-accent"
    >
      {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * The one-time secret. It lives only in the props/state of this render tree:
 * never in storage, the URL or the console, and it is dropped when the user
 * confirms (or the page is left).
 */
function SecretPanel({ issued, onDone }: { issued: Issued; onDone: () => void }) {
  const c = issued.credential;
  // Leaving the page loses the secret for good: make the browser ask first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <Card
      title={issued.kind === "created" ? "Credential created" : "Credential rotated"}
      subtitle={`${c.name} · ${c.environment}`}
      className="border-warning/40"
    >
      <div role="alert" className="flex gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm text-ink">
          <strong>This secret is shown only once and cannot be recovered.</strong> Copy it now and
          store it in a secret manager (never in git or the frontend). If you lose it, rotate the
          credential and use the new pair.
        </p>
      </div>

      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
            API key (public, sent in X-Api-Key)
          </dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 rounded-md border border-edge bg-surface-raised px-3 py-2 font-mono text-xs break-all text-accent select-all">
              {c.api_key}
            </code>
            <CopyButton text={c.api_key} label="Copy API key" />
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
            API secret (never sent; it only computes the signature)
          </dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 rounded-md border border-warning/40 bg-surface-raised px-3 py-2 font-mono text-xs break-all text-ink select-all">
              {c.api_secret}
            </code>
            <CopyButton text={c.api_secret} label="Copy API secret" />
          </dd>
        </div>
      </dl>

      {issued.kind === "rotated" && issued.overlapEnds && (
        <p className="mt-3 text-xs text-ink-muted">
          The previous pair keeps working until{" "}
          <strong className="text-ink">{formatDateTime(issued.overlapEnds)}</strong>. Deploy the
          new pair before then.
        </p>
      )}

      <div className="mt-4">
        <Button onClick={onDone}>I have stored it</Button>
      </div>
    </Card>
  );
}

export function ApiCredentialsCard({ info }: { info: SessionInfo }) {
  const router = useRouter();
  const canManage = info.user.role === "owner" || info.user.role === "admin";
  const sandboxTenant = info.environment === "sandbox";

  const [creds, setCreds] = useState<ApiCredential[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [creating, setCreating] = useState(false);
  const [rotating, setRotating] = useState<ApiCredential | null>(null);

  // create form
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "live">(info.environment);
  const [scopes, setScopes] = useState<string[]>([]);
  const [days, setDays] = useState(180);
  const [createIps, setCreateIps] = useState("");
  const [createIpMode, setCreateIpMode] = useState<"" | "observe" | "enforce">("");
  // IP allow-list editor
  const [ipEditing, setIpEditing] = useState<ApiCredential | null>(null);
  const [ipText, setIpText] = useState("");
  const [ipMode, setIpMode] = useState<"observe" | "enforce">("observe");
  const [ipEvents, setIpEvents] = useState<IpEvent[] | null>(null);
  // rotate form
  const [overlapHours, setOverlapHours] = useState(24);

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
    if (!canManage) return;
    setError(null);
    try {
      const res = await identityFetch<{ data: ApiCredential[] }>("GET", "api-credentials");
      setCreds(res.data);
    } catch (err) {
      await handle(err);
    }
  }, [canManage, handle]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
    } catch (err) {
      if (err instanceof IdentityError) setError(err.message);
      else await handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function openIpEditor(c: ApiCredential) {
    setNotice(null);
    setIpEditing(c);
    setIpText(c.allowed_cidrs.join("\n"));
    setIpMode(c.ip_mode);
    setIpEvents(null);
    try {
      const res = await identityFetch<{ data: IpEvent[] }>("GET", `api-credentials/${c.id}/ip-events`);
      setIpEvents(res.data);
    } catch (err) {
      if (err instanceof IdentityError) setError(err.message);
      else await handle(err);
    }
  }

  function toggleScope(scope: string) {
    setScopes((cur) => (cur.includes(scope) ? cur.filter((s) => s !== scope) : [...cur, scope]));
  }

  if (!canManage) {
    return (
      <Card title="API credentials" subtitle="Only owners and admins manage credentials">
        <p className="text-sm text-ink-muted">
          You are signed in with the <Badge tone="slate">{info.user.role}</Badge> role. API
          credentials (key + secret) sign the requests of your integrations; ask an owner or
          admin of <strong className="text-ink">{info.tenant.name}</strong> to create one for you.
        </p>
      </Card>
    );
  }

  if (creds === null) {
    return error ? <ErrorBanner message={error} onRetry={() => void load()} /> : <LoadingCard />;
  }

  const formOpen = creating || rotating !== null || ipEditing !== null;
  const locked = busy || issued !== null; // a pending secret must be acknowledged first

  return (
    <>
      {issued && (
        <SecretPanel
          issued={issued}
          onDone={() => {
            setIssued(null);
            setNotice(null);
          }}
        />
      )}
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {notice && (
        <p role="status" className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-2 text-xs text-ink">
          {notice}
        </p>
      )}

      {creating && (
        <Card
          title="New API credential"
          subtitle="A key and a secret that sign your integration's requests"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const res = await identityFetch<IssuedCredential>(
                  "POST",
                  "api-credentials",
                  {
                    environment,
                    name: name.trim(),
                    scopes,
                    expires_in_days: days,
                    allowed_cidrs: parseCidrs(createIps),
                    ...(createIpMode ? { ip_mode: createIpMode } : {}),
                  },
                  { csrf: true },
                );
                setIssued({ kind: "created", credential: res });
                setCreating(false);
                setName("");
                setScopes([]);
                setDays(180);
                setCreateIps("");
                setCreateIpMode("");
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">Name</span>
                <input
                  required
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="payments-backend"
                  className={INPUT}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">Environment</span>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as "sandbox" | "live")}
                  className="h-10 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink"
                >
                  <option value="sandbox">sandbox</option>
                  <option value="live" disabled={sandboxTenant}>
                    live
                  </option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">Expires in (days)</span>
                <input
                  type="number"
                  required
                  min={1}
                  max={365}
                  step={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="h-10 w-28 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink"
                />
              </label>
            </div>
            {sandboxTenant && (
              <p className="text-xs text-ink-faint">
                Your tenant is a sandbox tenant: it can only create sandbox credentials.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Allowed IPs <span className="text-ink-faint">(optional; one address or CIDR per line, IPv4 or IPv6)</span>
                </span>
                <textarea
                  rows={3}
                  value={createIps}
                  onChange={(e) => setCreateIps(e.target.value)}
                  placeholder={"203.0.113.7\n198.51.100.0/24\n2001:db8::/32"}
                  className="w-full rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent/60"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">If outside the list</span>
                <select
                  value={createIpMode}
                  onChange={(e) => setCreateIpMode(e.target.value as "" | "observe" | "enforce")}
                  className="h-10 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink"
                >
                  <option value="">Default (live: block)</option>
                  <option value="observe">Observe (let through, record)</option>
                  <option value="enforce">Enforce (block, 403)</option>
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-ink-muted">
                Scopes <span className="text-ink-faint">(pick at least one; none is preselected)</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCOPES.map((s) => (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-edge bg-surface-raised px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(s.value)}
                      onChange={() => toggleScope(s.value)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-mono text-xs text-ink">{s.value}</span>
                      <span className="block text-[11px] text-ink-faint">{s.help}</span>
                    </span>
                  </label>
                ))}
              </div>
              <details className="mt-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-danger">
                  Dangerous scope
                </summary>
                <label className="mt-2 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={scopes.includes(DANGEROUS_SCOPE)}
                    onChange={() => toggleScope(DANGEROUS_SCOPE)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-mono text-xs text-ink">{DANGEROUS_SCOPE}</span>
                    <span className="block text-[11px] text-ink-muted">
                      Lets this credential post to frozen accounts, bypassing a control that exists
                      to stop money moving. Grant it only to a credential that needs it, and keep
                      its term short.
                    </span>
                  </span>
                </label>
              </details>
            </fieldset>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !name.trim() || scopes.length === 0}>
                <KeyRound size={15} aria-hidden="true" />
                Create credential
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {ipEditing && (
        <Card title={`IP allow-list · ${ipEditing.name}`} subtitle={ipEditing.api_key}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const target = ipEditing;
              const list = parseCidrs(ipText);
              if (
                ipMode === "enforce" &&
                list.length > 0 &&
                !window.confirm(
                  `Enforce: from now on every request signed with ${target.api_key} from an address outside this list fails with 403 ip_not_allowed. Make sure your servers' outbound IPs are in it. Continue?`,
                )
              )
                return;
              void run(async () => {
                const res = await identityFetch<ApiCredential>(
                  "PUT",
                  `api-credentials/${target.id}/ip-allowlist`,
                  { allowed_cidrs: list, ip_mode: list.length === 0 ? "observe" : ipMode },
                  { csrf: true },
                );
                setIpEditing(null);
                setNotice(
                  res.allowed_cidrs.length === 0
                    ? `${target.name} now accepts requests from any address.`
                    : `${target.name}: ${res.allowed_cidrs.length} allowed ${res.allowed_cidrs.length === 1 ? "entry" : "entries"}, ${res.ip_mode} mode.`,
                );
              });
            }}
          >
            <p className="text-xs text-ink-muted">
              Only requests from these addresses may use this credential. Leave it empty to accept
              any address. <strong className="text-ink">Observe</strong> lets other addresses through
              and records them below, so you can check the list before blocking;{" "}
              <strong className="text-ink">enforce</strong> rejects them with 403{" "}
              <code className="font-mono">ip_not_allowed</code>. The address is the one the API
              sees; behind a proxy it is the client address the proxy reports.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                Allowed IPs (one address or CIDR per line; at most 50)
              </span>
              <textarea
                rows={5}
                value={ipText}
                onChange={(e) => setIpText(e.target.value)}
                placeholder={"203.0.113.7\n198.51.100.0/24\n2001:db8::/32"}
                className="w-full rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent/60"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">Mode</span>
              <select
                value={ipMode}
                onChange={(e) => setIpMode(e.target.value as "observe" | "enforce")}
                className="h-10 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink"
              >
                <option value="observe">Observe (let through, record)</option>
                <option value="enforce">Enforce (block, 403)</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                <ShieldCheck size={15} aria-hidden="true" />
                Save allow-list
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIpEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>

          <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-ink-faint uppercase">
            Recent addresses outside the list
          </h4>
          {ipEvents === null ? (
            <p className="text-xs text-ink-muted">Loading…</p>
          ) : ipEvents.length === 0 ? (
            <p className="text-xs text-ink-muted">None seen.</p>
          ) : (
            <Table>
              <THead>
                <TH>Address</TH>
                <TH>Result</TH>
                <TH className="text-right">Requests</TH>
                <TH>First seen</TH>
                <TH>Last seen</TH>
              </THead>
              <TBody>
                {ipEvents.map((ev) => (
                  <TR key={`${ev.ip}-${ev.outcome}`}>
                    <TD>
                      <code className="font-mono text-xs text-ink">{ev.ip}</code>
                    </TD>
                    <TD>
                      <Badge tone={ev.outcome === "rejected" ? "red" : "amber"} dot>
                        {ev.outcome === "rejected" ? "rejected" : "let through"}
                      </Badge>
                    </TD>
                    <TD className="text-right text-xs">{ev.hits.toLocaleString()}</TD>
                    <TD className="text-xs whitespace-nowrap">{formatDateTime(ev.first_seen_at)}</TD>
                    <TD className="text-xs whitespace-nowrap">{formatDateTime(ev.last_seen_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {rotating && (
        <Card
          title={`Rotate ${rotating.name}`}
          subtitle={rotating.api_key}
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const target = rotating;
              void run(async () => {
                const overlapMs = Math.round(overlapHours * 3600) * 1000;
                const res = await identityFetch<IssuedCredential>(
                  "POST",
                  `api-credentials/${target.id}/rotate`,
                  { overlap_seconds: overlapMs / 1000 },
                  { csrf: true },
                );
                setIssued({
                  kind: "rotated",
                  credential: res,
                  overlapEnds: new Date(Date.now() + overlapMs).toISOString(),
                });
                setRotating(null);
                setOverlapHours(24);
              });
            }}
          >
            <p className="text-xs text-ink-muted">
              A new key and secret are issued with the same name, environment and scopes. The
              current pair keeps working during the overlap so you can deploy the new one without
              downtime; after it, the current pair stops working.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                Overlap (hours, 1 to 168)
              </span>
              <input
                type="number"
                required
                min={1}
                max={168}
                step={1}
                value={overlapHours}
                onChange={(e) => setOverlapHours(Number(e.target.value))}
                className="h-10 w-28 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                <RefreshCw size={15} aria-hidden="true" />
                Rotate
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRotating(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="API credentials"
        subtitle="Key + secret that sign every request of your integrations. The secret is shown only once, when it is created."
        flush
        actions={
          <Button
            size="sm"
            disabled={locked || formOpen}
            onClick={() => {
              setNotice(null);
              setCreating(true);
            }}
          >
            <Plus size={13} aria-hidden="true" />
            Create credential
          </Button>
        }
      >
        {creds.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-muted">
            No credentials yet. Create one to start sending signed requests.
          </p>
        ) : (
          <Table>
            <THead>
              <TH>Name</TH>
              <TH>Env</TH>
              <TH>API key</TH>
              <TH>Scopes</TH>
              <TH>IP list</TH>
              <TH>Status</TH>
              <TH>Created</TH>
              <TH>Expires</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {creds.map((c) => (
                <TR key={c.id}>
                  <TD className="text-ink">{c.name}</TD>
                  <TD>
                    <Badge tone={c.environment === "live" ? "emerald" : "violet"} dot>
                      {c.environment}
                    </Badge>
                  </TD>
                  <TD>
                    <code className="rounded-md border border-edge bg-surface-raised px-2 py-0.5 font-mono text-xs whitespace-nowrap text-accent">
                      {c.api_key}
                    </code>
                  </TD>
                  <TD>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {c.scopes.map((s) => (
                        <Badge key={s} tone="slate" className="font-mono text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    {c.allowed_cidrs.length === 0 ? (
                      <span className="text-xs text-ink-faint">Any address</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Badge tone={c.ip_mode === "enforce" ? "emerald" : "amber"} dot>
                          {c.ip_mode}
                        </Badge>
                        {c.allowed_cidrs.length} {c.allowed_cidrs.length === 1 ? "entry" : "entries"}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[c.status]} dot>
                      {c.status}
                    </Badge>
                  </TD>
                  <TD className="text-xs whitespace-nowrap">{formatDate(c.created_at)}</TD>
                  <TD className="text-xs whitespace-nowrap">
                    {formatDate(c.expires_at)}
                    {c.rotated_to && c.status === "active" && (
                      <span className="mt-0.5 block text-warning">
                        Rotating until {formatDateTime(c.expires_at)}
                      </span>
                    )}
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    {c.status === "active" && (
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          disabled={locked || formOpen}
                          onClick={() => void openIpEditor(c)}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
                        >
                          <ShieldCheck size={13} aria-hidden="true" /> IPs
                        </button>
                        {!c.rotated_to && (
                          <button
                            type="button"
                            disabled={locked || formOpen}
                            onClick={() => {
                              setNotice(null);
                              setRotating(c);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
                          >
                            <RefreshCw size={13} aria-hidden="true" /> Rotate
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Revoke "${c.name}" (${c.api_key})? The next request signed with it fails immediately with credential_revoked. This cannot be undone.`,
                              )
                            )
                              return;
                            void run(async () => {
                              await identityFetch("DELETE", `api-credentials/${c.id}`, undefined, {
                                csrf: true,
                              });
                              setNotice(`${c.name} is revoked.`);
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs text-danger hover:underline disabled:opacity-50"
                        >
                          <Trash2 size={13} aria-hidden="true" /> Revoke
                        </button>
                      </span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
