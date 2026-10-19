// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, Plus, ShieldCheck, Terminal, Webhook } from "lucide-react";
import { DemoBadge } from "@/components/demo-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { mockDevelopers } from "@/lib/mock-data";
import {
  apiBaseUrl,
  hasSession,
  sessionClaims,
  storedApiKey,
  type SessionClaims,
} from "@/lib/session";

const LIVE_CURL = (api: string) => `# 1. Exchange your API key for a 15-min JWT
TOKEN=$(curl -s -X POST ${api}/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{ "api_key": "lk_sandbox_..." }' | jq -r .access_token)

# 2. Post your first double-entry transaction
curl -s -X POST ${api}/v1/transactions \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ledger_id": "<LEDGER_ID>",
    "idempotency_key": "dep-0001",
    "description": "Customer USD deposit",
    "postings": [
      { "account_id": "<CASH>",   "direction": "DEBIT",  "amount": { "asset": "USD", "amount": "10000" } },
      { "account_id": "<WALLET>", "direction": "CREDIT", "amount": { "asset": "USD", "amount": "9700" } },
      { "account_id": "<FEES>",   "direction": "CREDIT", "amount": { "asset": "USD", "amount": "300" } }
    ]
  }'`;

function keyPrefix(key: string | null): string {
  if (!key) return "—";
  // lk_sandbox_9f8e7d6c... -> lk_sandbox_9f8e
  const m = key.match(/^(lk_[a-z]+_[0-9a-f]{4})/i);
  return m ? `${m[1]}…` : `${key.slice(0, 14)}…`;
}

function LiveDevelopers() {
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  useEffect(() => {
    void sessionClaims().then(setClaims);
  }, []);
  const api = apiBaseUrl() || "http://localhost:8080";

  return (
    <>
      <Card
        title="Current session"
        subtitle="Tenant identity derived from the session JWT"
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
              <KeyRound size={12} aria-hidden="true" /> API key
            </dt>
            <dd className="mt-1 font-mono text-xs text-accent">
              {keyPrefix(storedApiKey())}
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
          The JWT lasts 15 minutes; the console renews it automatically by
          re-exchanging the API key stored on this device.
        </p>
      </Card>

      <Card
        title="Getting started"
        subtitle="Token + first double-entry transaction against the real API"
      >
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-edge bg-[#04070c] p-4">
            <div className="mb-3 flex items-center gap-2 text-ink-faint">
              <Terminal size={13} aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-wider uppercase">
                POST /v1/auth/token → POST /v1/transactions
              </span>
            </div>
            <pre className="font-mono text-xs leading-relaxed text-ink-muted">
              <code>{LIVE_CURL(api)}</code>
            </pre>
          </div>
          <p className="text-xs text-ink-faint">
            Full guide from zero to your first transaction at{" "}
            <a href="/docs/quickstart" className="text-accent hover:underline">
              /docs/quickstart
            </a>
            . Amounts are integers in minor units, string-encoded
            (&quot;10000&quot; = $100.00) — never floats.
          </p>
        </div>
      </Card>
    </>
  );
}

function DemoDevelopers() {
  const { apiKeys, webhooks } = mockDevelopers;
  return (
    <>
      <Card
        title="API keys"
        subtitle="Keys are shown only once at creation; only the prefix is listed here"
        flush
        actions={
          <span className="group relative inline-block">
            <button
              type="button"
              disabled
              className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-(--radius-control) border border-edge-strong px-3 text-xs font-medium text-ink-faint opacity-60"
            >
              <Plus size={13} aria-hidden="true" />
              Create key
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute top-full right-0 z-10 mt-2 w-56 rounded-lg border border-edge bg-surface-raised px-3 py-2 text-[11px] text-ink-muted opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
            >
              Issuing additional keys is coming soon; today keys are created
              through the sandbox signup.
            </span>
          </span>
        }
      >
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Prefix</TH>
            <TH>Created</TH>
            <TH className="text-right">Last used</TH>
          </THead>
          <TBody>
            {apiKeys.map((apiKey) => (
              <TR key={apiKey.id}>
                <TD>
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <KeyRound size={13} className="text-ink-faint" aria-hidden="true" />
                    {apiKey.name}
                  </span>
                </TD>
                <TD>
                  <code className="rounded-md border border-edge bg-surface-raised px-2 py-0.5 font-mono text-xs text-accent">
                    {apiKey.prefix}
                  </code>
                </TD>
                <TD className="text-xs">{formatDate(apiKey.createdAt)}</TD>
                <TD className="text-right text-xs whitespace-nowrap">
                  {apiKey.lastUsedAt ? (
                    formatDateTime(apiKey.lastUsedAt)
                  ) : (
                    <span className="text-ink-faint">never</span>
                  )}
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
          <h1 className="text-xl font-semibold tracking-tight text-ink">
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
