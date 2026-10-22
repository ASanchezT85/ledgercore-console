// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Manual double-entry: pick a ledger, add postings (account, side, amount in
 * minor units), see per-asset balance live, confirm, and post it (or save it
 * as a draft). The API is the only judge of validity; this only blocks what it
 * would refuse anyway (unbalanced, empty).
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoneyWithAsset } from "@/lib/format";
import {
  apiErrorText,
  assetExponent,
  createTransaction,
  listAccounts,
  listLedgers,
  newIdempotencyKey,
  type ApiAccount,
  type ApiLedger,
  type ApiPosting,
  type Direction,
} from "@/lib/live";

interface Row {
  account_id: string;
  direction: Direction;
  asset: string;
  amount: string;
}

const blank = (asset = "USD", direction: Direction = "DEBIT"): Row => ({
  account_id: "",
  direction,
  asset,
  amount: "",
});

/** Debits minus credits per asset; all zero means balanced. */
export function imbalance(rows: Row[]): Map<string, bigint> {
  const m = new Map<string, bigint>();
  for (const r of rows) {
    if (!/^\d+$/.test(r.amount)) continue;
    const v = BigInt(r.amount) * (r.direction === "DEBIT" ? 1n : -1n);
    m.set(r.asset, (m.get(r.asset) ?? 0n) + v);
  }
  return m;
}

export function NewTransaction({
  onCreated,
  onCancel,
}: {
  onCreated: (message: string) => void;
  onCancel: () => void;
}) {
  const [ledgers, setLedgers] = useState<ApiLedger[]>([]);
  const [ledgerId, setLedgerId] = useState("");
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [rows, setRows] = useState<Row[]>([blank(), blank("USD", "CREDIT")]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [asDraft, setAsDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [key] = useState(() => newIdempotencyKey("txn"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLedgers().then(
      (p) => {
        setLedgers(p.data);
        if (p.data[0]) setLedgerId(p.data[0].id);
      },
      (e) => setError(apiErrorText(e)),
    );
  }, []);
  useEffect(() => {
    if (!ledgerId) return;
    listAccounts(ledgerId).then(
      (p) => setAccounts(p.data.filter((a) => a.postable !== false)),
      (e) => setError(apiErrorText(e)),
    );
  }, [ledgerId]);

  const diff = imbalance(rows);
  const balanced = [...diff.values()].every((v) => v === 0n);
  const filled = rows.every((r) => r.account_id && /^[1-9]\d*$/.test(r.amount) && r.asset);
  const ok = filled && balanced && rows.length >= 2 && ledgerId !== "";

  const set = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const postings: ApiPosting[] = rows.map((r) => ({
        account_id: r.account_id,
        direction: r.direction,
        amount: { asset: r.asset.trim().toUpperCase(), amount: r.amount },
      }));
      const t = await createTransaction({
        ledger_id: ledgerId,
        idempotency_key: key,
        status: asDraft ? "draft" : "posted",
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        postings,
      });
      onCreated(`Transaction ${t.id} ${t.status}.`);
    } catch (e) {
      setError(apiErrorText(e));
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card title="New transaction" subtitle="Debits and credits must balance per asset. Amounts are in minor units (cents).">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Ledger">
          <select className={inputClass} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
            {ledgers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} maxLength={1024} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Reference">
          <input className={inputClass} value={reference} maxLength={255} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_7rem_6rem_9rem_auto] sm:items-end">
            <Field label={i === 0 ? "Account" : ""}>
              <select className={inputClass} value={r.account_id} onChange={(e) => set(i, { account_id: e.target.value })}>
                <option value="">Choose…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label={i === 0 ? "Side" : ""}>
              <select className={inputClass} value={r.direction} onChange={(e) => set(i, { direction: e.target.value as Direction })}>
                <option value="DEBIT">DEBIT</option>
                <option value="CREDIT">CREDIT</option>
              </select>
            </Field>
            <Field label={i === 0 ? "Asset" : ""}>
              <input className={inputClass} value={r.asset} maxLength={16} onChange={(e) => set(i, { asset: e.target.value })} />
            </Field>
            <Field label={i === 0 ? "Amount (minor units)" : ""}>
              <input className={inputClass} inputMode="numeric" value={r.amount} onChange={(e) => set(i, { amount: e.target.value.replace(/\D/g, "") })} />
            </Field>
            <Button size="sm" variant="ghost" disabled={rows.length <= 2} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove posting">
              ×
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <Button size="sm" variant="outline" onClick={() => setRows((rs) => [...rs, blank(rs[rs.length - 1]?.asset)])}>
          Add posting
        </Button>
        {[...diff.entries()].map(([asset, v]) => (
          <span key={asset} className={v === 0n ? "text-accent" : "text-danger"}>
            {asset}: {v === 0n ? "balanced" : `off by ${formatMoneyWithAsset(v < 0n ? -v : v, asset, assetExponent(asset))} (${v > 0n ? "more debits" : "more credits"})`}
          </span>
        ))}
        <label className="ml-auto flex items-center gap-2 text-ink-faint">
          <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
          Save as draft (post later)
        </label>
      </div>
      <ErrorLine message={error} />
      <div className="mt-4 flex items-center gap-2">
        {!confirming ? (
          <Button size="sm" disabled={!ok || busy} onClick={() => setConfirming(true)}>
            {asDraft ? "Save draft…" : "Post…"}
          </Button>
        ) : (
          <>
            <span className="text-xs text-ink">
              {asDraft ? "Save this draft?" : "Post this transaction? Posted entries cannot be edited, only reversed."}
            </span>
            <Button size="sm" disabled={busy} onClick={() => void submit()}>
              {busy ? "Working…" : "Confirm"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Back
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
