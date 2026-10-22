// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Manual double-entry: pick a ledger, add postings, see the per-asset balance
 * live, confirm, and post it (or save it as a draft). The same form with
 * `variant="adjustment"` files an adjustment request for the maker-checker
 * flow instead. The API is the only judge of validity; this only blocks what
 * it would refuse anyway (unbalanced, empty).
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass } from "@/components/form";
import {
  isBalanced,
  PostingsEditor,
  rowsFilled,
  toPostings,
  twoRows,
} from "@/components/postings-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  apiErrorText,
  createAdjustment,
  createTransaction,
  listAccounts,
  listLedgers,
  listPeriods,
  newIdempotencyKey,
  type ApiAccount,
  type ApiLedger,
  type ApiPeriod,
} from "@/lib/live";

export function NewTransaction({
  variant = "transaction",
  onCreated,
  onCancel,
}: {
  variant?: "transaction" | "adjustment";
  onCreated: (message: string) => void;
  onCancel: () => void;
}) {
  const adjustment = variant === "adjustment";
  const [ledgers, setLedgers] = useState<ApiLedger[]>([]);
  const [ledgerId, setLedgerId] = useState("");
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [periods, setPeriods] = useState<ApiPeriod[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [rows, setRows] = useState(twoRows);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [asDraft, setAsDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [key] = useState(() => newIdempotencyKey(adjustment ? "adjustment" : "txn"));
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
    if (adjustment)
      listPeriods(ledgerId).then(
        (p) => setPeriods(p.data.filter((x) => x.status !== "open")),
        () => setPeriods([]),
      );
  }, [ledgerId, adjustment]);

  const ok =
    rowsFilled(rows) && isBalanced(rows) && ledgerId !== "" && (!adjustment || effectiveAt !== "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const common = {
        ledger_id: ledgerId,
        idempotency_key: key,
        postings: toPostings(rows),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      };
      if (adjustment) {
        const a = await createAdjustment({
          ...common,
          effective_at: new Date(effectiveAt).toISOString(),
          ...(periodId ? { adjusts_period_id: periodId } : {}),
        });
        onCreated(`Adjustment request ${a.id} is ${a.status}. A second person must approve it.`);
      } else {
        const t = await createTransaction({ ...common, status: asDraft ? "draft" : "posted" });
        onCreated(`Transaction ${t.id} ${t.status}.`);
      }
    } catch (e) {
      setError(apiErrorText(e));
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card
      title={adjustment ? "New adjustment request" : "New transaction"}
      subtitle={
        adjustment
          ? "Needs two approvals from people other than you before it can be executed."
          : "Debits and credits must balance per asset. Amounts are in minor units (cents)."
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Ledger">
          <select className={inputClass} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
            {ledgers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input className={inputClass} value={description} maxLength={1024} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Reference">
          <input className={inputClass} value={reference} maxLength={255} onChange={(e) => setReference(e.target.value)} />
        </Field>
        {adjustment && (
          <>
            <Field label="Effective at (required)">
              <input type="datetime-local" className={inputClass} value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} />
            </Field>
            <Field label="Adjusts closed period (optional)">
              <select className={inputClass} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                <option value="">none</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>

      <div className="mt-4">
        <PostingsEditor rows={rows} setRows={setRows} accounts={accounts} />
      </div>
      {!adjustment && (
        <label className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
          <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
          Save as draft (post later)
        </label>
      )}
      <ErrorLine message={error} />
      <div className="mt-4 flex items-center gap-2">
        {!confirming ? (
          <Button size="sm" disabled={!ok || busy} onClick={() => setConfirming(true)}>
            {adjustment ? "Request…" : asDraft ? "Save draft…" : "Post…"}
          </Button>
        ) : (
          <>
            <span className="text-xs text-ink">
              {adjustment
                ? "Send this for approval?"
                : asDraft
                  ? "Save this draft?"
                  : "Post this transaction? Posted entries cannot be edited, only reversed."}
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
