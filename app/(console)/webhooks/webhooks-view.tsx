// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/**
 * Webhook endpoints and their deliveries. A signing secret is shown exactly
 * once, when an endpoint is created or its secret rotated, and is never kept
 * by the console; there is no way to read it again.
 */

import { useEffect, useState } from "react";
import { DemoBadge } from "@/components/demo-badge";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { ApiDownBanner, ErrorBanner, LoadingCard, useLiveData } from "@/components/live";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  apiErrorText,
  createSubscription,
  listDeliveries,
  listSubscriptions,
  retryDelivery,
  rotateSubscriptionSecret,
  updateSubscription,
  WEBHOOK_EVENT_TYPES,
  type ApiDelivery,
  type ApiSubscription,
  type DeliveryStatus,
} from "@/lib/live";

const TONE: Record<DeliveryStatus, BadgeTone> = {
  pending: "sky",
  delivered: "emerald",
  failed: "amber",
  dead: "red",
};

function SecretBox({ secret, onClose }: { secret: string; onClose: () => void }) {
  return (
    <div role="alert" className="rounded-(--radius-card) border border-warning/40 bg-warning/10 px-5 py-4">
      <p className="text-sm font-medium text-ink">Copy the signing secret now. It is not shown again.</p>
      <code className="mt-2 block overflow-x-auto font-mono text-xs break-all text-ink">{secret}</code>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(secret)}>Copy</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>I saved it</Button>
      </div>
    </div>
  );
}

function NewEndpoint({ onCreated }: { onCreated: (s: ApiSubscription) => void }) {
  const [url, setUrl] = useState("");
  const [types, setTypes] = useState<string[]>(["*"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title="New endpoint" subtitle="HTTPS is mandatory in live. Deliveries are signed with HMAC-SHA256.">
      <Field label="URL"><input className={inputClass} value={url} placeholder="https://example.com/hooks/ledgercore" onChange={(e) => setUrl(e.target.value)} /></Field>
      <fieldset className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
        <legend className="mb-1">Event types</legend>
        {WEBHOOK_EVENT_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-1.5">
            <input type="checkbox" checked={types.includes(t)} onChange={(e) => setTypes((cur) => (e.target.checked ? [...cur, t] : cur.filter((x) => x !== t)))} />
            <code className="font-mono">{t}</code>
          </label>
        ))}
      </fieldset>
      <ErrorLine message={error} />
      <div className="mt-3">
        <Button size="sm" disabled={busy || !/^https?:\/\//.test(url) || types.length === 0} onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            onCreated(await createSubscription({ url: url.trim(), event_types: types }));
            setUrl("");
          } catch (e) {
            setError(apiErrorText(e));
          } finally {
            setBusy(false);
          }
        }}>{busy ? "Creating…" : "Create endpoint"}</Button>
      </div>
    </Card>
  );
}

function Deliveries({ subs }: { subs: ApiSubscription[] }) {
  const [status, setStatus] = useState<"" | DeliveryStatus>("");
  const [sub, setSub] = useState("");
  const [rows, setRows] = useState<ApiDelivery[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDeliveries({ subscription_id: sub || undefined, status: status || undefined }).then(
      (p) => {
        setRows(p.data);
        setCursor(p.next_cursor ?? null);
        setError(null);
      },
      (e) => setError(apiErrorText(e)),
    );
  }, [status, sub, version]);

  return (
    <Card
      title="Deliveries"
      subtitle="Newest first. Failed and dead deliveries can be retried."
      actions={
        <span className="flex gap-2">
          <select className={inputClass} value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Endpoint">
            <option value="">all endpoints</option>
            {subs.map((s) => (<option key={s.id} value={s.id}>{s.url}</option>))}
          </select>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
            <option value="">any status</option>
            {(Object.keys(TONE) as DeliveryStatus[]).map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </span>
      }
      flush
    >
      <ErrorLine message={error} />
      <Table>
        <THead>
          <TH>Event</TH>
          <TH>Status</TH>
          <TH className="text-right">Attempts</TH>
          <TH>Last result</TH>
          <TH>Created</TH>
          <TH><span className="sr-only">Actions</span></TH>
        </THead>
        <TBody>
          {rows.length === 0 && (<TR><TD colSpan={6} className="py-8 text-center text-ink-faint">No deliveries.</TD></TR>)}
          {rows.map((d) => (
            <TR key={d.id}>
              <TD className="font-mono text-xs text-ink">{d.event_type}</TD>
              <TD><Badge tone={TONE[d.status]}>{d.status}</Badge></TD>
              <TD className="num text-right">{d.attempts}</TD>
              <TD className="text-xs">{d.last_status_code ?? "—"} {d.last_error ?? ""}</TD>
              <TD className="text-xs whitespace-nowrap">{formatDateTime(d.created_at)}</TD>
              <TD className="text-right">
                {(d.status === "failed" || d.status === "dead") && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    try {
                      await retryDelivery(d.id);
                      setVersion((v) => v + 1);
                    } catch (e) {
                      setError(apiErrorText(e));
                    }
                  }}>Retry</Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {cursor && (
        <div className="flex justify-center border-t border-edge py-3">
          <Button size="sm" variant="outline" onClick={async () => {
            try {
              const p = await listDeliveries({ subscription_id: sub || undefined, status: status || undefined }, cursor);
              setRows((r) => [...r, ...p.data]);
              setCursor(p.next_cursor ?? null);
            } catch (e) {
              setError(apiErrorText(e));
            }
          }}>Load more</Button>
        </div>
      )}
    </Card>
  );
}

function Endpoints({ subs, reload, onNotice, onSecret }: { subs: ApiSubscription[]; reload: () => void; onNotice: (m: string) => void; onSecret: (s: string) => void }) {
  const [pending, setPending] = useState<{ id: string; what: "rotate" | "toggle" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(s: ApiSubscription, what: "rotate" | "toggle") {
    setError(null);
    try {
      if (what === "rotate") {
        const r = await rotateSubscriptionSecret(s.id);
        onSecret(r.secret);
        onNotice(`Secret rotated. The previous one keeps verifying until ${formatDateTime(r.previous_secret_expires_at)}.`);
      } else {
        await updateSubscription(s.id, { active: !s.active });
        onNotice(`Endpoint ${s.active ? "paused" : "resumed"}.`);
      }
      setPending(null);
      reload();
    } catch (e) {
      setError(apiErrorText(e));
    }
  }

  return (
    <Card title="Endpoints" flush>
      <ErrorLine message={error} />
      <Table>
        <THead>
          <TH>URL</TH>
          <TH>Events</TH>
          <TH>Status</TH>
          <TH><span className="sr-only">Actions</span></TH>
        </THead>
        <TBody>
          {subs.length === 0 && (<TR><TD colSpan={4} className="py-8 text-center text-ink-faint">No endpoints yet.</TD></TR>)}
          {subs.map((s) => (
            <TR key={s.id}>
              <TD className="font-mono text-xs break-all text-ink">{s.url}</TD>
              <TD className="text-xs">{s.event_types.join(", ")}</TD>
              <TD><Badge tone={s.active ? "emerald" : "slate"} dot>{s.active ? "active" : "paused"}</Badge></TD>
              <TD className="text-right">
                {pending?.id === s.id ? (
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-xs text-ink">{pending.what === "rotate" ? "Rotate the secret? The new one is shown once." : s.active ? "Pause deliveries?" : "Resume deliveries?"}</span>
                    <Button size="sm" onClick={() => void run(s, pending.what)}>Confirm</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Back</Button>
                  </span>
                ) : (
                  <span className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPending({ id: s.id, what: "toggle" })}>{s.active ? "Pause…" : "Resume…"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPending({ id: s.id, what: "rotate" })}>Rotate secret…</Button>
                  </span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

export function WebhooksView() {
  const state = useLiveData(async () => (await listSubscriptions()).data);
  const [notice, setNotice] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">Webhooks</h1>
          <p className="mt-0.5 text-sm text-ink-faint">Endpoints that receive LedgerCore events, and their deliveries</p>
        </div>
        <DemoBadge demo={state.status === "demo"} />
      </div>
      <Notice message={notice} />
      {secret && <SecretBox secret={secret} onClose={() => setSecret(null)} />}
      {state.status === "loading" && <LoadingCard orb="solving" />}
      {state.status === "demo" && (
        <Card><p className="py-6 text-center text-sm text-ink-muted">Sign in to manage your webhook endpoints.</p></Card>
      )}
      {state.status === "down" && <ApiDownBanner onRetry={state.reload} />}
      {state.status === "error" && <ErrorBanner message={state.message} onRetry={state.reload} />}
      {state.status === "live" && (
        <>
          <NewEndpoint onCreated={(s) => {
            if (s.secret) setSecret(s.secret);
            setNotice(`Endpoint ${s.url} created.`);
            state.reload();
          }} />
          <Endpoints subs={state.data} reload={state.reload} onNotice={setNotice} onSecret={setSecret} />
          <Deliveries subs={state.data} />
        </>
      )}
    </div>
  );
}
