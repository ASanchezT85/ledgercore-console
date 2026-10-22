// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useCallback, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { Notice } from "@/components/form";
import { NewTransaction } from "@/components/new-transaction";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/demo-badge";
import {
  ApiDownBanner,
  EmptyState,
  ErrorBanner,
  LoadingCard,
  useLiveData,
} from "@/components/live";
import {
  assetExponent,
  loadTransactionsPage,
  type ApiTxnStatus,
  type TransactionFilters,
  transactionTotals,
  type ApiTransaction,
  type LiveTransactionsPage,
} from "@/lib/live";
import { mockTransactions } from "@/lib/mock-data";
import type { Transaction } from "@/lib/types";
import { TransactionsExplorer } from "./transactions-explorer";

const FIRST_TXN_CURL = `curl -s -X POST $API/v1/transactions \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ledger_id": "$LEDGER_ID",
    "idempotency_key": "dep-0001",
    "description": "Customer USD deposit",
    "postings": [
      { "account_id": "$CASH_ID",   "direction": "DEBIT",  "amount": { "asset": "USD", "amount": "10000" } },
      { "account_id": "$WALLET_ID", "direction": "CREDIT", "amount": { "asset": "USD", "amount": "9700" } },
      { "account_id": "$FEES_ID",   "direction": "CREDIT", "amount": { "asset": "USD", "amount": "300" } }
    ]
  }'`;

/** Maps the real API transaction into the explorer's view model. */
function toViewTransaction(
  txn: ApiTransaction,
  accountNames: Record<string, string>,
  ledgerNames: Record<string, string>,
): Transaction {
  const totals = transactionTotals(txn);
  const main = totals[0] ?? { asset: "USD", amount: "0" };
  const exponent = assetExponent(main.asset);
  return {
    id: txn.id,
    ledger: ledgerNames[txn.ledger_id] ?? txn.ledger_id,
    description: txn.description || txn.idempotency_key,
    // The API's "draft" maps to the explorer's "pending" bucket.
    status:
      txn.status === "draft"
        ? "pending"
        : txn.status === "reversed" || txn.status === "discarded"
          ? txn.status
          : "posted",
    amountUnits: BigInt(main.amount),
    asset: main.asset,
    exponent,
    createdAt: txn.created_at,
    idempotencyKey: txn.idempotency_key,
    reverses: txn.reverses,
    postings: txn.postings.map((p) => ({
      account: accountNames[p.account_id] ?? p.account_id,
      direction: p.direction === "DEBIT" ? "debit" : "credit",
      amountUnits: BigInt(p.amount.amount),
      asset: p.amount.asset,
      exponent: assetExponent(p.amount.asset),
    })),
  };
}

function LiveTransactions({
  initial,
  filters,
  onChanged,
}: {
  initial: LiveTransactionsPage;
  filters: TransactionFilters;
  onChanged: (message: string) => void;
}) {
  const [pages, setPages] = useState<LiveTransactionsPage[]>([initial]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  const last = pages[pages.length - 1] ?? initial;
  const accountNames = Object.assign({}, ...pages.map((p) => p.accountNames));
  const ledgerNames = Object.assign({}, ...pages.map((p) => p.ledgerNames));
  const transactions = pages
    .flatMap((p) => p.transactions)
    .map((t) => toViewTransaction(t, accountNames, ledgerNames));

  const loadMore = useCallback(async () => {
    if (!last.nextCursor) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = await loadTransactionsPage(last.nextCursor, filters);
      setPages((prev) => [...prev, next]);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [last.nextCursor, filters]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No transactions yet"
        body="Once you post your first double-entry transaction it will appear here, with its postings and idempotency key. This is the canonical curl for the 100 / 97 / 3 deposit:"
        curl={FIRST_TXN_CURL}
        curlLabel="POST /v1/transactions"
      />
    );
  }

  return (
    <>
      <TransactionsExplorer transactions={transactions} onChanged={onChanged} />
      {last.nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) border border-edge-strong px-4 text-xs font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent disabled:opacity-50"
          >
            {loadingMore && (
              <ThinkingOrb state="solving" size={20} aria-hidden="true" />
            )}
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
      {moreError && (
        <p className="text-center text-xs text-danger">
          Could not load the next page. Please try again.
        </p>
      )}
    </>
  );
}

const FILTER_INPUT =
  "h-9 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-xs text-ink";

/** Server-side filters (6.7): they combine with AND; a parent account covers its subtree. */
function FilterBar({
  options,
  onApply,
}: {
  options: { ledgers: Record<string, string>; accounts: Record<string, string> };
  onApply: (f: TransactionFilters) => void;
}) {
  const [ledger, setLedger] = useState("");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const pairOk = (key.trim() === "") === (value.trim() === "");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pairOk) return;
        onApply({
          ledger_id: ledger || undefined,
          status: (status || undefined) as ApiTxnStatus | undefined,
          account_id: account || undefined,
          metadata_key: key.trim() || undefined,
          metadata_value: value.trim() || undefined,
        });
      }}
    >
      <select className={FILTER_INPUT} value={ledger} onChange={(e) => setLedger(e.target.value)} aria-label="Ledger">
        <option value="">All ledgers</option>
        {Object.entries(options.ledgers).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>
      <select className={FILTER_INPUT} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
        <option value="">Any status</option>
        {["posted", "draft", "reversed", "discarded"].map((st) => (
          <option key={st} value={st}>{st}</option>
        ))}
      </select>
      <select className={FILTER_INPUT} value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Account">
        <option value="">Any account</option>
        {Object.entries(options.accounts).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>
      <input className={FILTER_INPUT} placeholder="metadata key" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Metadata key" />
      <input className={FILTER_INPUT} placeholder="metadata value" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Metadata value" />
      <button
        type="submit"
        disabled={!pairOk}
        className="h-9 rounded-(--radius-control) border border-edge-strong px-4 text-xs font-medium text-ink hover:border-accent/60 hover:text-accent disabled:opacity-50"
      >
        Apply filters
      </button>
      {!pairOk && (
        <span className="text-xs text-danger">Metadata needs both key and value.</span>
      )}
    </form>
  );
}

export function TransactionsView() {
  const applied = useRef<TransactionFilters>({});
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [options, setOptions] = useState<{
    ledgers: Record<string, string>;
    accounts: Record<string, string>;
  }>({ ledgers: {}, accounts: {} });
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const state = useLiveData(async () => {
    const page = await loadTransactionsPage(undefined, applied.current);
    setOptions((o) =>
      Object.keys(o.ledgers).length
        ? o
        : { ledgers: page.ledgerNames, accounts: page.accountNames },
    );
    return page;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">
            Transactions
          </h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Double-entry activity: every transaction balances debits and
            credits per asset
          </p>
        </div>
        <span className="flex items-center gap-3">
          <DemoBadge demo={state.status === "demo"} />
          {state.status === "live" && !creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              New transaction
            </Button>
          )}
        </span>
      </div>

      <Notice message={notice} />
      {creating && (
        <NewTransaction
          onCancel={() => setCreating(false)}
          onCreated={(m) => {
            setCreating(false);
            setNotice(m);
            state.reload();
          }}
        />
      )}

      {state.status !== "demo" && (
        <FilterBar
          options={options}
          onApply={(f) => {
            applied.current = f;
            setFilters(f);
            state.reload();
          }}
        />
      )}

      {state.status === "loading" && <LoadingCard orb="solving" />}
      {state.status === "demo" && (
        <TransactionsExplorer transactions={mockTransactions} />
      )}
      {state.status === "down" && <ApiDownBanner onRetry={state.reload} />}
      {state.status === "error" && (
        <ErrorBanner message={state.message} onRetry={state.reload} />
      )}
      {state.status === "live" && (
        <LiveTransactions initial={state.data} filters={filters} onChanged={(m) => {
            setNotice(m);
            state.reload();
          }} />
      )}
    </div>
  );
}
