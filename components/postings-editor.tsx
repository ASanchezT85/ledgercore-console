// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/** Rows of postings (account, side, asset, amount in minor units) with a live per-asset balance check. */

import { Field, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { formatMoneyWithAsset } from "@/lib/format";
import {
  assetExponent,
  type ApiAccount,
  type ApiPosting,
  type Direction,
} from "@/lib/live";

export interface Row {
  account_id: string;
  direction: Direction;
  asset: string;
  amount: string;
}

export const blankRow = (asset = "USD", direction: Direction = "DEBIT"): Row => ({
  account_id: "",
  direction,
  asset,
  amount: "",
});

export const twoRows = (): Row[] => [blankRow(), blankRow("USD", "CREDIT")];

/** Debits minus credits per asset; all zero means balanced. */
export function imbalance(rows: Row[]): Map<string, bigint> {
  const m = new Map<string, bigint>();
  for (const r of rows) {
    if (!/^\d+$/.test(r.amount)) continue;
    const v = BigInt(r.amount) * (r.direction === "DEBIT" ? 1n : -1n);
    const asset = r.asset.trim().toUpperCase();
    m.set(asset, (m.get(asset) ?? 0n) + v);
  }
  return m;
}

export function isBalanced(rows: Row[]): boolean {
  return [...imbalance(rows).values()].every((v) => v === 0n);
}

/** Every row names an account, an asset and a positive integer amount. */
export function rowsFilled(rows: Row[]): boolean {
  return (
    rows.length >= 2 &&
    rows.every((r) => r.account_id && r.asset.trim() && /^[1-9]\d*$/.test(r.amount))
  );
}

export function toPostings(rows: Row[]): ApiPosting[] {
  return rows.map((r) => ({
    account_id: r.account_id,
    direction: r.direction,
    amount: { asset: r.asset.trim().toUpperCase(), amount: r.amount },
  }));
}

export function PostingsEditor({
  rows,
  setRows,
  accounts,
}: {
  rows: Row[];
  setRows: (rows: Row[]) => void;
  accounts: ApiAccount[];
}) {
  const set = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const diff = imbalance(rows);

  return (
    <>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_7rem_6rem_9rem_auto] sm:items-end">
            <Field label={i === 0 ? "Account" : ""}>
              <select
                className={inputClass}
                value={r.account_id}
                onChange={(e) => set(i, { account_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={i === 0 ? "Side" : ""}>
              <select
                className={inputClass}
                value={r.direction}
                onChange={(e) => set(i, { direction: e.target.value as Direction })}
              >
                <option value="DEBIT">DEBIT</option>
                <option value="CREDIT">CREDIT</option>
              </select>
            </Field>
            <Field label={i === 0 ? "Asset" : ""}>
              <input
                className={inputClass}
                value={r.asset}
                maxLength={16}
                onChange={(e) => set(i, { asset: e.target.value })}
              />
            </Field>
            <Field label={i === 0 ? "Amount (minor units)" : ""}>
              <input
                className={inputClass}
                inputMode="numeric"
                value={r.amount}
                onChange={(e) => set(i, { amount: e.target.value.replace(/\D/g, "") })}
              />
            </Field>
            <Button
              size="sm"
              variant="ghost"
              disabled={rows.length <= 2}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              aria-label="Remove posting"
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRows([...rows, blankRow(rows[rows.length - 1]?.asset)])}
        >
          Add posting
        </Button>
        {[...diff.entries()].map(([asset, v]) => (
          <span key={asset} className={v === 0n ? "text-accent" : "text-danger"}>
            {asset}:{" "}
            {v === 0n
              ? "balanced"
              : `off by ${formatMoneyWithAsset(v < 0n ? -v : v, asset, assetExponent(asset))} (${v > 0n ? "more debits" : "more credits"})`}
          </span>
        ))}
      </div>
    </>
  );
}
