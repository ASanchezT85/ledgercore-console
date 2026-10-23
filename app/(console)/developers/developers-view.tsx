// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, Plus, ShieldCheck, Terminal, User, Webhook } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { mockDevelopers } from "@/lib/mock-data";
import {
  apiBaseUrl,
  getSessionInfo,
  hasSession,
  sessionClaims,
  type SessionClaims,
  type SessionInfo,
} from "@/lib/session";
import { ApiCredentialsCard } from "./api-credentials";

const LIVE_SNIPPET = (api: string) => `import { LedgerCore } from "@ledgercore/sdk";

// The SDK signs every request for you (X-Api-Key, X-Timestamp, X-Nonce, X-Signature).
const lc = new LedgerCore({
  apiKey: process.env.LEDGERCORE_API_KEY,       // ak_sandbox_XXXXXXXXXXXXXXXXXXXX
  apiSecret: process.env.LEDGERCORE_API_SECRET, // as_sandbox_... (shown once, keep it in a secret manager)
  baseUrl: "${api}",
});

const ledger = await lc.ledgers.create({ name: "main" });
const accounts = await lc.accounts.list({ ledger_id: ledger.id });`;

const CANONICAL = `X-Signature = hex( HMAC-SHA256( api_secret, canonical ) )

canonical = "LC1-HMAC-SHA256" 
 METHOD 
 host 
 path 
 query 
 api_key
            
 timestamp 
 nonce 
 idempotency_key 
 hex(sha256(body))`;

function LiveDevelopers() {
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  useEffect(() => {
    void sessionClaims().then(setClaims);
    void getSessionInfo().then(setInfo);
  }, []);
  const api = apiBaseUrl() || "http://localhost:8080";

  return (
    <>
      <Card
        title="Current session"
        subtitle="Identity and scopes of your signed-in session"
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-edge bg-surface-raised px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
              <Fingerprint size={12} aria-hidden="true" /> Tenant
            </dt>
            <dd className="mt-1 font-mono text-xs break-all text-ink">
              {claims?.tenantId ?? "…"}
            </dd>
          </div>
          <div className="rounded-lg border border-edge bg-surface-raised px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
              <ShieldCheck size={12} aria-hidden="true" /> Environment
            </dt>
            <dd className="mt-1.5">
              <Badge tone={claims?.env === "live" ? "emerald" : "violet"} dot>
                {claims?.env ?? "…"}
              </Badge>
            </dd>
          </div>
          <div className="rounded-lg border border-edge bg-surface-raised px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
              <User size={12} aria-hidden="true" /> Signed in as
            </dt>
            <dd className="mt-1 text-xs break-all text-accent">
              {info ? `${info.user.email} · ${info.user.role}` : "…"}
            </dd>
          </div>
          <div className="rounded-lg border border-edge bg-surface-raised px-4 py-3">
            <dt className="text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
              Scopes
            </dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {(claims?.scopes ?? []).map((s) => (
                <Badge key={s} tone="slate" className="font-mono">
                  {s}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-faint">
          The JWT lasts 15 minutes; the console renews it automatically from your
          signed-in session. API credentials are for your integrations only: the
          console never stores a secret.
        </p>
      </Card>

      {info && <ApiCredentialsCard info={info} />}

      <Card
        title="Getting started"
        subtitle="Sign your requests with an API credential and make your first call"
      >
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-edge bg-code p-4">
            <div className="mb-3 flex items-center gap-2 text-ink-faint">
              <Terminal size={13} aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-wider uppercase">
                Node · @ledgercore/sdk
              </span>
            </div>
            <pre className="font-mono text-xs leading-relaxed text-ink-muted">
              <code>{LIVE_SNIPPET(api)}</code>
            </pre>
          </div>
          <p className="text-xs text-ink-faint">
            Without an SDK, send the headers <code className="font-mono">X-Api-Key</code>,{" "}
            <code className="font-mono">X-Timestamp</code> (unix seconds, ±300 s),{" "}
            <code className="font-mono">X-Nonce</code> (new on every request) and{" "}
            <code className="font-mono">X-Signature</code>, computed like this:
          </p>
          <div className="overflow-x-auto rounded-lg border border-edge bg-code p-4">
            <pre className="font-mono text-xs leading-relaxed text-ink-muted">
              <code>{CANONICAL}</code>
            </pre>
          </div>
          <p className="text-xs text-ink-faint">
            The query string is signed too. Full scheme, errors and test vectors at{" "}
            <a href="/docs/guias/autenticacion" className="text-accent hover:underline">
              /docs/guias/autenticacion
            </a>
            ; first transaction at{" "}
            <a href="/docs/quickstart" className="text-accent hover:underline">
              /docs/quickstart
            </a>
            . Amounts are integers in minor units, string-encoded
            (&quot;10000&quot; = $100.00) — never floats.
          </p>
          <p className="text-xs text-ink-faint">
            The old <code className="font-mono">lk_</code> keys and{" "}
            <code className="font-mono">POST /v1/auth/token</code> are deprecated: they keep
            working until 2027-02-01 and then answer{" "}
            <code className="font-mono">legacy_credential_retired</code>.
          </p>
        </div>
      </Card>
    </>
  );
}

function DemoDevelopers() {
  const { credentials, webhooks } = mockDevelopers;
  return (
    <>
      <Card
        title="API credentials"
        subtitle="Key + secret that sign every request. The secret is shown only once, at creation; it is never listed"
        flush
        actions={
          <span className="group relative inline-block">
            <button
              type="button"
              disabled
              className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-(--radius-control) border border-edge-strong px-3 text-xs font-medium text-ink-faint opacity-60"
            >
              <Plus size={13} aria-hidden="true" />
              Create credential
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute top-full right-0 z-10 mt-2 w-56 rounded-lg border border-edge bg-surface-raised px-3 py-2 text-[11px] text-ink-muted opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
            >
              Demo data: sign in with your email and password to create real
              credentials (an owner or admin role is required).
            </span>
          </span>
        }
      >
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Env</TH>
            <TH>API key</TH>
            <TH>Scopes</TH>
            <TH>Status</TH>
            <TH className="text-right">Expires</TH>
          </THead>
          <TBody>
            {credentials.map((credential) => (
              <TR key={credential.id}>
                <TD>
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <KeyRound size={13} className="text-ink-faint" aria-hidden="true" />
                    {credential.name}
                  </span>
                </TD>
                <TD>
                  <Badge tone={credential.environment === "live" ? "emerald" : "violet"} dot>
                    {credential.environment}
                  </Badge>
                </TD>
                <TD>
                  <code className="rounded-md border border-edge bg-surface-raised px-2 py-0.5 font-mono text-xs text-accent">
                    {credential.apiKey}
                  </code>
                </TD>
                <TD>
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {credential.scopes.map((scope) => (
                      <Badge key={scope} tone="slate" className="font-mono text-[10px]">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD>
                  <Badge tone={credential.status === "active" ? "emerald" : "red"} dot>
                    {credential.status}
                  </Badge>
                </TD>
                <TD className="text-right text-xs whitespace-nowrap">
                  {formatDate(credential.expiresAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card
        title="Webhook subscriptions"
        subtitle="Signed delivery of v1 envelope events via NATS → webhooks"
        flush
      >
        <Table>
          <THead>
            <TH>Endpoint</TH>
            <TH>Topics</TH>
            <TH>Status</TH>
            <TH className="text-right">Created</TH>
          </THead>
          <TBody>
            {webhooks.map((subscription) => (
              <TR key={subscription.id}>
                <TD>
                  <span className="inline-flex items-center gap-2">
                    <Webhook size={13} className="text-ink-faint" aria-hidden="true" />
                    <span className="font-mono text-xs text-ink">
                      {subscription.url}
                    </span>
                  </span>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1.5">
                    {subscription.topics.map((topic) => (
                      <Badge key={topic} tone="slate" className="font-mono">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD>
                  <Badge
                    tone={subscription.status === "active" ? "emerald" : "amber"}
                    dot
                  >
                    {subscription.status === "active" ? "active" : "paused"}
                  </Badge>
                </TD>
                <TD className="text-right text-xs whitespace-nowrap">
                  {formatDate(subscription.createdAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

export function DevelopersView() {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    setLive(hasSession());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">
            Developers
          </h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Credentials, session and first steps to integrate LedgerCore
          </p>
        </div>
        <DemoBadge demo={live === false} />
      </div>
      {live === true && <LiveDevelopers />}
      {live === false && <DemoDevelopers />}
    </div>
  );
}
