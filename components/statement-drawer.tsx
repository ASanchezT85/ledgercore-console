// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Statement drawer: fetches GET /v1/statements for one account and renders
 * the period, opening/closing balances and entries with running balance.
 * Client-side CSV export, no extra dependencies.
 */

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoneyWithAsset } from "@/lib/format";
import {
  type ApiStatement,
  type ApiStatementEntry,
  assetExponent,
  getStatement,
  type StatementFilters,
} from "@/lib/live";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; statement: ApiStatement; entries: ApiStatementEntry[] };

function toCsv(statement: ApiStatement, entries: ApiStatementEntry[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    [
      "posting_id",
      "transaction_id",
      "reference",
      "direction",
      "asset",
      "amount",
      "effective_at",
      "running_balance",
    ].join(","),
    ...entries.map((e) =>
      [
        e.id,
        e.transaction_id,
        esc(e.reference ?? ""),
        e.direction,
        e.amount.asset,
        e.amount.amount,
        e.effective_at,
        e.running_balance,
      ].join(","),
    ),
  ];
  return lines.join("\n");
}

function downloadCsv(statement: ApiStatement, entries: ApiStatementEntry[]) {
  const blob = new Blob([toCsv(statement, entries)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `statement-${statement.account.name.replace(/[^a-z0-9_-]+/gi, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function BalanceRow({
  label,
  balances,
}: {
  label: string;
  balances: ApiStatement["opening_balance"];
}) {
  return (
    <div className="flex items-center justify-between border-b border-edge py-2">
      <span className="text-xs font-semibold tracking-wider text-ink-faint uppercase">
        {label}
      </span>
      <span className="flex flex-col items-end gap-0.5">
        {balances.length === 0 && (
          <span className="text-xs text-ink-faint">—</span>
        )}
        {balances.map((b) => (
          <span key={b.asset} className="num text-[13px] font-medium text-ink">
            {formatMoneyWithAsset(BigInt(b.amount), b.asset, b.exponent)}
          </span>
        ))}
      </span>
    </div>
  );
}

export function StatementDrawer({
  accountId,
  accountName,
  onClose,
}: {
  accountId: string;
  accountName: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [applied, setApplied] = useState<StatementFilters>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metaKey, setMetaKey] = useState("");
  const [metaValue, setMetaValue] = useState("");
  const pairOk = (metaKey.trim() === "") === (metaValue.trim() === "");

  function apply() {
    if (!pairOk) return;
    setApplied({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      metadata_key: metaKey.trim() || undefined,
      metadata_value: metaValue.trim() || undefined,
    });
  }

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        // Follow the cursor so the export covers the whole period.
        const first = await getStatement(accountId, undefined, 100, applied);
        const entries = [...first.entries];
        let cursor = first.next_cursor;
        while (cursor && entries.length < 1000) {
          const page = await getStatement(accountId, cursor, 100, applied);
          entries.push(...page.entries);
          cursor = page.next_cursor;
        }
        if (!cancelled) setState({ status: "ready", statement: first, entries });
      } catch (err) {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "unknown_error",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, applied]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/60"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-edge bg-surface p-5 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Account statement
            </h2>
            <p className="mt-0.5 font-mono text-xs text-ink-faint">
              {accountName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {state.status === "ready" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCsv(state.statement, state.entries)}
              >
                <Download size={13} aria-hidden="true" /> CSV
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close drawer">
              <X size={14} aria-hidden="true" />
            </Button>
          </div>
        </header>

        <form
          className="mb-4 grid grid-cols-2 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          {(
            [
              ["From", "datetime-local", from, setFrom],
              ["To", "datetime-local", to, setTo],
              ["Metadata key", "text", metaKey, setMetaKey],
              ["Metadata value", "text", metaValue, setMetaValue],
            ] as const
          ).map(([label, type, value, set]) => (
            <label key={label} className="space-y-1 text-[11px] text-ink-faint">
              {label}
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                className="h-8 w-full rounded-(--radius-control) border border-edge-strong bg-surface-raised px-2 text-xs text-ink"
              />
            </label>
          ))}
          <div className="col-span-2 flex items-center gap-3">
            <Button type="submit" size="sm" variant="outline" disabled={!pairOk}>
              Apply
            </Button>
            {!pairOk && (
              <span className="text-xs text-danger">
                Metadata needs both key and value.
              </span>
            )}
          </div>
        </form>

        {state.status === "loading" && (
          <p className="py-8 text-center text-sm text-ink-faint">Loading…</p>
        )}
        {state.status === "error" && (
          <p className="py-8 text-center text-sm text-danger">
            Could not load the statement: {state.message}
          </p>
        )}
        {state.status === "ready" && (
          <>
            <p className="mb-3 text-xs text-ink-faint">
              Period{" "}
              {new Date(state.statement.period.from).toLocaleDateString()} —{" "}
              {new Date(state.statement.period.to).toLocaleDateString()} {applied.from || applied.to ? "" : "(last 30 days)"}
            </p>
            <BalanceRow
              label="Opening balance"
              balances={state.statement.opening_balance}
            />
            <ul>
              {state.entries.length === 0 && (
                <li className="py-6 text-center text-xs text-ink-faint">
                  No activity in this period
                </li>
              )}
              {state.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 border-b border-edge py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-ink">
                      {e.reference || e.transaction_id}
                    </p>
                    {e.account_path && (
                      <p className="truncate font-mono text-[11px] text-ink-muted">
                        {e.account_path}
                      </p>
                    )}
                    <p className="text-[11px] text-ink-faint">
                      {new Date(e.effective_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span
                      className={`num text-[13px] font-medium ${
                        e.direction === "CREDIT" ? "text-accent" : "text-ink"
                      }`}
                    >
                      {e.direction === "CREDIT" ? "+" : "−"}
                      {formatMoneyWithAsset(
                        BigInt(e.amount.amount),
                        e.amount.asset,
                        assetExponent(e.amount.asset),
                      )}
                    </span>
                    <span className="num text-[11px] text-ink-faint">
                      balance{" "}
                      {formatMoneyWithAsset(
                        BigInt(e.running_balance),
                        e.amount.asset,
                        assetExponent(e.amount.asset),
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <BalanceRow
              label="Closing balance"
              balances={state.statement.closing_balance}
            />
          </>
        )}
      </aside>
    </div>
  );
}
