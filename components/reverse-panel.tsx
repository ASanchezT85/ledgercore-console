// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Reversal of a posted transaction (6.12): full, or partial when an amount is
 * given (a partial chargeback). Shows the effective reversal state the API
 * reports and what is left to reverse, and asks for confirmation before the
 * money moves.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoneyWithAsset, parseMinorUnits } from "@/lib/format";
import {
  ApiError,
  getTransaction,
  newIdempotencyKey,
  reverseTransaction,
  type ApiTransaction,
} from "@/lib/live";

const inputClass =
  "h-9 w-full rounded-(--radius-control) border border-edge-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint";

export function ReversePanel({
  transactionId,
  asset,
  exponent,
  totalUnits,
  onReversed,
}: {
  transactionId: string;
  /** Main asset of the transaction (partial reversal is single-asset only). */
  asset: string;
  exponent: number;
  totalUnits: bigint;
  onReversed: () => void;
}) {
  const [txn, setTxn] = useState<ApiTransaction | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [key] = useState(() => newIdempotencyKey("reverse"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    getTransaction(transactionId).then(setTxn, () => setTxn(null));
  }, [transactionId, done]);

  const state = txn?.reversal?.effective_status;
  const reversed = BigInt(txn?.reversal?.reversed_amount?.amount ?? "0");
  const left = totalUnits - reversed;
  const partial = amount.trim() !== "";
  const units = partial ? parseMinorUnits(amount, exponent) : null;
  const amountOk = !partial || (units !== null && units <= left);
  const fmt = (u: bigint) => formatMoneyWithAsset(u, asset, exponent);

  if (txn && (txn.status === "draft" || txn.status === "discarded")) return null;
  if (txn?.reverses) return null; // a reversal is only reversed in full, from the API

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const rev = await reverseTransaction(transactionId, {
        idempotency_key: key,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(partial && units ? { amount: { asset, amount: units.toString() } } : {}),
      });
      setDone(`Reversal ${rev.id} posted.`);
      setConfirming(false);
      setAmount("");
      onReversed();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.code}${err.apiMessage ? ` — ${err.apiMessage}` : ""}`
          : err instanceof Error
            ? err.message
            : "unknown_error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-edge bg-surface-raised px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
          Reverse
        </p>
        {state && (
          <Badge tone={state === "posted" ? "slate" : "amber"}>
            {state.replace("_", " ")}
            {reversed > 0n ? ` · ${fmt(reversed)}` : ""}
          </Badge>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-ink-faint">
          Amount to reverse in {asset} (empty = everything left, {fmt(left)})
          <input
            className={inputClass}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={fmt(left)}
          />
        </label>
        <label className="space-y-1 text-xs text-ink-faint">
          Reason (optional)
          <input
            className={inputClass}
            value={reason}
            maxLength={1024}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>
      {!amountOk && (
        <p className="mt-2 text-xs text-danger">
          Enter a positive amount with at most {exponent} decimals, up to {fmt(left)}.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-2 text-xs text-accent">
          {done}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {!confirming ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!amountOk || left <= 0n}
            onClick={() => setConfirming(true)}
          >
            Reverse…
          </Button>
        ) : (
          <>
            <span className="text-xs text-ink">
              Move back {partial && units ? fmt(units) : fmt(left)}? This posts a
              compensating transaction.
            </span>
            <Button size="sm" disabled={busy} onClick={() => void submit()}>
              {busy ? "Reversing…" : "Confirm reversal"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
