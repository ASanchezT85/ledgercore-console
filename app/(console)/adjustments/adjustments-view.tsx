// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/**
 * Adjustment requests (maker-checker): a request needs two approvals from
 * people other than its maker, then anyone with write access executes it.
 * The API refuses self-approval and a stale hash; the console just shows what
 * is being approved (the postings) next to the button that approves it.
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { LedgerScope } from "@/components/ledger-scope";
import { NewTransaction } from "@/components/new-transaction";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatMoneyWithAsset } from "@/lib/format";
import {
  actOnAdjustment,
  apiErrorText,
  assetExponent,
  listAdjustments,
  type AdjustmentStatus,
  type ApiAdjustment,
} from "@/lib/live";

const TONE: Record<AdjustmentStatus, BadgeTone> = {
  pending: "amber",
  approved: "sky",
  executed: "emerald",
  rejected: "red",
  cancelled: "slate",
};

type Act = "approve" | "reject" | "cancel" | "execute";

const ACTIONS: Record<AdjustmentStatus, Act[]> = {
  pending: ["approve", "reject", "cancel"],
  approved: ["execute", "cancel"],
  executed: [],
  rejected: [],
  cancelled: [],
};

const WARN: Record<Act, string> = {
  approve: "Approve exactly these postings?",
  reject: "Reject this request?",
  cancel: "Cancel this request?",
  execute: "Execute it? This posts the adjustment to the ledger.",
};

function Row({ a, onDone }: { a: ApiAdjustment; onDone: (m: string) => void }) {
  const [pending, setPending] = useState<Act | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await actOnAdjustment(a.id, pending, a.request_hash);
      onDone(`Request ${a.id}: ${pending} done.`);
    } catch (e) {
      setError(apiErrorText(e));
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 border-t border-edge py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-ink">{a.id}</span>
        <Badge tone={TONE[a.status]}>{a.status}</Badge>
      </div>
      <p className="text-ink-faint">
        {a.description || a.reference || a.idempotency_key} · maker {a.maker} · effective {formatDateTime(a.effective_at)}
        {a.adjusts_period_id ? " · adjusts a closed period" : ""}
      </p>
      <ul className="rounded-md border border-edge px-3 py-2 font-mono">
        {a.postings.map((p, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="truncate">{p.direction} {p.account_id}</span>
            <span className="num">{formatMoneyWithAsset(BigInt(p.amount.amount), p.amount.asset, assetExponent(p.amount.asset))}</span>
          </li>
        ))}
      </ul>
      <p className="text-ink-faint">
        Approvals ({a.approvals.length}/2): {a.approvals.map((x) => x.approver).join(", ") || "none"}
        {a.transaction_id ? ` · transaction ${a.transaction_id}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {pending === null ? (
          ACTIONS[a.status].map((act) => (
            <Button key={act} size="sm" variant={act === "approve" || act === "execute" ? "outline" : "ghost"} onClick={() => setPending(act)}>
              {act[0]!.toUpperCase() + act.slice(1)}…
            </Button>
          ))
        ) : (
          <>
            <span className="text-ink">{WARN[pending]}</span>
            <Button size="sm" disabled={busy} onClick={() => void run()}>{busy ? "Working…" : "Confirm"}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending(null)}>Back</Button>
          </>
        )}
      </div>
      <ErrorLine message={error} />
    </li>
  );
}

function AdjustmentsBody({ ledgerId }: { ledgerId: string }) {
  const [status, setStatus] = useState<"" | AdjustmentStatus>("pending");
  const [rows, setRows] = useState<ApiAdjustment[] | null>(null);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listAdjustments(ledgerId, status || undefined).then(
      (p) => {
        setRows(p.data);
        setError(null);
      },
      (e) => setError(apiErrorText(e)),
    );
  }, [ledgerId, status, version]);

  const refresh = (m: string) => {
    setNotice(m);
    setCreating(false);
    setVersion((v) => v + 1);
  };

  return (
    <>
      <Notice message={notice} />
      {creating && <NewTransaction variant="adjustment" onCancel={() => setCreating(false)} onCreated={refresh} />}
      <Card
        title="Requests"
        subtitle="Newest first"
        actions={
          <span className="flex items-center gap-2">
            <Field label="">
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="">any status</option>
                {(Object.keys(TONE) as AdjustmentStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            {!creating && <Button size="sm" onClick={() => setCreating(true)}>New request</Button>}
          </span>
        }
      >
        <ErrorLine message={error} />
        {rows?.length === 0 && <p className="text-sm text-ink-faint">No requests.</p>}
        <ul>{rows?.map((a) => <Row key={a.id} a={a} onDone={refresh} />)}</ul>
      </Card>
    </>
  );
}

export function AdjustmentsView() {
  return (
    <LedgerScope
      title="Adjustments"
      subtitle="Corrections that need two approvals (maker-checker)"
      demoNote="Sign in to review adjustment requests."
    >
      {(ledger) => <AdjustmentsBody ledgerId={ledger.id} />}
    </LedgerScope>
  );
}
