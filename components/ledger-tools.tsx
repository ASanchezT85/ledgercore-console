// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Per-ledger tools on the Ledgers page: create an account, change the ledger's
 * policies (custody loss rule, FX quotes, stale movements, metadata keys) and
 * read the coverage report with its signed snapshots.
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass, splitList } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime, formatMoneyWithAsset } from "@/lib/format";
import {
  apiErrorText,
  createAccount,
  createCoverageSnapshot,
  getCoverage,
  listCoverageSnapshots,
  setCustodyPolicy,
  setFxPolicy,
  setMetadataPolicy,
  setMovementPolicy,
  type AccountType,
  type ApiCoverage,
  type ApiCoverageSnapshot,
  type ApiLedger,
  type Direction,
  type LossAllocation,
} from "@/lib/live";

type Tool = "account" | "policies" | "coverage";

const NORMAL: Record<AccountType, Direction> = {
  asset: "DEBIT",
  expense: "DEBIT",
  liability: "CREDIT",
  equity: "CREDIT",
  revenue: "CREDIT",
};

function NewAccount({ ledger, onDone }: { ledger: ApiLedger; onDone: (m: string) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("liability");
  const [fund, setFund] = useState<"" | "customer" | "own">("");
  const [liquidity, setLiquidity] = useState<"" | "liquid" | "claim">("");
  const [transit, setTransit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const a = await createAccount({
        ledger_id: ledger.id,
        name: name.trim(),
        type,
        normal_balance: NORMAL[type],
        ...(fund ? { fund_class: fund } : {}),
        ...(liquidity ? { liquidity } : {}),
        ...(transit ? { transit: true } : {}),
      });
      onDone(`Created account ${a.name}.`);
    } catch (e) {
      setError(apiErrorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Name (: separates levels)" className="sm:col-span-2">
          <input className={inputClass} value={name} maxLength={255} placeholder="liabilities:holder:ana:available" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {(Object.keys(NORMAL) as AccountType[]).map((t) => (
              <option key={t} value={t}>{t} ({NORMAL[t].toLowerCase()}-normal)</option>
            ))}
          </select>
        </Field>
        <Field label="Fund class">
          <select className={inputClass} value={fund} onChange={(e) => setFund(e.target.value as typeof fund)}>
            <option value="">default</option>
            <option value="customer">customer</option>
            <option value="own">own</option>
          </select>
        </Field>
        <Field label="Liquidity (asset accounts)">
          <select className={inputClass} value={liquidity} onChange={(e) => setLiquidity(e.target.value as typeof liquidity)}>
            <option value="">default (liquid)</option>
            <option value="liquid">liquid</option>
            <option value="claim">claim</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 pt-5 text-xs text-ink-faint">
          <input type="checkbox" checked={transit} onChange={(e) => setTransit(e.target.checked)} />
          Transit account (cannot be changed later)
        </label>
      </div>
      <ErrorLine message={error} />
      <Button size="sm" disabled={busy || name.trim() === ""} onClick={() => void submit()}>
        {busy ? "Creating…" : "Create account"}
      </Button>
    </div>
  );
}

function Policies({ ledger, onDone }: { ledger: ApiLedger; onDone: (m: string) => void }) {
  const [loss, setLoss] = useState<LossAllocation>(ledger.loss_allocation ?? "pro_rata_pool");
  const [fx, setFx] = useState(ledger.require_fx_quote ?? false);
  const [stale, setStale] = useState(ledger.stale_movement_after ?? "");
  const [txKeys, setTxKeys] = useState(ledger.metadata_policy?.transaction_keys?.join(", ") ?? "");
  const [acctKeys, setAcctKeys] = useState(ledger.metadata_policy?.account_keys?.join(", ") ?? "");
  const [limitTx, setLimitTx] = useState(ledger.metadata_policy?.transaction_keys != null);
  const [limitAcct, setLimitAcct] = useState(ledger.metadata_policy?.account_keys != null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      onDone(`Saved ${label} for ${ledger.name}.`);
    } catch (e) {
      setError(apiErrorText(e));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Field label="Provider loss rule (no default; ADR-020)">
            <select className={inputClass} value={loss} onChange={(e) => setLoss(e.target.value as LossAllocation)}>
              <option value="pro_rata_pool">pro_rata_pool</option>
              <option value="by_provider">by_provider</option>
            </select>
          </Field>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("loss rule", () => setCustodyPolicy(ledger.id, loss))}>
            Save loss rule
          </Button>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 pt-5 text-xs text-ink-faint">
            <input type="checkbox" checked={fx} onChange={(e) => setFx(e.target.checked)} />
            Require an FX quote for multi-asset transactions
          </label>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("FX policy", () => setFxPolicy(ledger.id, fx))}>
            Save FX policy
          </Button>
        </div>
        <div className="space-y-2">
          <Field label="Stale movement after (Go duration, e.g. 720h; empty = off)">
            <input className={inputClass} value={stale} onChange={(e) => setStale(e.target.value)} />
          </Field>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("movement policy", () => setMovementPolicy(ledger.id, stale.trim() || null))}>
            Save movement policy
          </Button>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-ink-faint">
            <input type="checkbox" checked={limitTx} onChange={(e) => setLimitTx(e.target.checked)} />
            Restrict transaction metadata keys
          </label>
          {limitTx && <input className={inputClass} value={txKeys} placeholder="key1, key2" onChange={(e) => setTxKeys(e.target.value)} />}
          <label className="flex items-center gap-2 text-xs text-ink-faint">
            <input type="checkbox" checked={limitAcct} onChange={(e) => setLimitAcct(e.target.checked)} />
            Restrict account metadata keys
          </label>
          {limitAcct && <input className={inputClass} value={acctKeys} placeholder="key1, key2" onChange={(e) => setAcctKeys(e.target.value)} />}
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void run("metadata policy", () =>
                setMetadataPolicy(ledger.id, {
                  transaction_keys: limitTx ? splitList(txKeys) : null,
                  account_keys: limitAcct ? splitList(acctKeys) : null,
                }),
              )
            }
          >
            Save metadata policy
          </Button>
        </div>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

function CoverageTable({ rows }: { rows: ApiCoverage["data"] }) {
  const money = (v: string, a: string, e: number) => formatMoneyWithAsset(BigInt(v), a, e);
  return (
    <Table>
      <THead>
        <TH>Asset</TH>
        <TH className="text-right">Customer assets</TH>
        <TH className="text-right">Claims</TH>
        <TH className="text-right">Customer liabilities</TH>
        <TH className="text-right">Shortfall</TH>
        <TH>Covered</TH>
      </THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.asset}>
            <TD>{r.asset}</TD>
            <TD className="num text-right">{money(r.customer_assets, r.asset, r.exponent)}</TD>
            <TD className="num text-right">{money(r.customer_claims, r.asset, r.exponent)}</TD>
            <TD className="num text-right">{money(r.customer_liabilities, r.asset, r.exponent)}</TD>
            <TD className="num text-right">{money(r.shortfall, r.asset, r.exponent)}</TD>
            <TD><Badge tone={r.covered ? "emerald" : "red"} dot>{r.covered ? "covered" : "short"}</Badge></TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function Coverage({ ledger }: { ledger: ApiLedger }) {
  const [cov, setCov] = useState<ApiCoverage | null>(null);
  const [snaps, setSnaps] = useState<ApiCoverageSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let off = false;
    Promise.all([getCoverage(ledger.id), listCoverageSnapshots(ledger.id)]).then(
      ([c, s]) => {
        if (off) return;
        setCov(c);
        setSnaps(s.data);
      },
      (e) => !off && setError(apiErrorText(e)),
    );
    return () => {
      off = true;
    };
  }, [ledger.id, version]);

  async function snapshot() {
    setBusy(true);
    setError(null);
    try {
      await createCoverageSnapshot(ledger.id, new Date().toISOString());
      setVersion((v) => v + 1);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorLine message={error} />
      {cov && (
        <>
          <div className="flex items-center gap-2">
            <Badge tone={cov.covered ? "emerald" : "red"} dot>
              {cov.covered ? "customer money is covered" : "customer money is NOT covered"}
            </Badge>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void snapshot()}>
              {busy ? "Saving…" : "Take snapshot now"}
            </Button>
          </div>
          <CoverageTable rows={cov.data} />
        </>
      )}
      {snaps.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Snapshots</p>
          <ul className="divide-y divide-edge text-xs">
            {snaps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{formatDateTime(s.as_of)} · {s.taken_by}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={s.covered ? "emerald" : "red"}>{s.covered ? "covered" : "short"}</Badge>
                  <code className="font-mono text-[11px] text-ink-faint" title={s.snapshot_hash}>
                    {s.snapshot_hash.slice(0, 12)}…
                  </code>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LedgerTools({ ledger, onChanged }: { ledger: ApiLedger; onChanged: (message: string) => void }) {
  const [tool, setTool] = useState<Tool | null>(null);
  const done = onChanged;
  return (
    <Card
      title={`Tools · ${ledger.name}`}
      actions={
        <span className="flex gap-2">
          {(["account", "policies", "coverage"] as const).map((t) => (
            <Button key={t} size="sm" variant={tool === t ? "primary" : "outline"} onClick={() => setTool(tool === t ? null : t)}>
              {t === "account" ? "New account" : t === "policies" ? "Policies" : "Coverage"}
            </Button>
          ))}
        </span>
      }
    >
      {tool === "account" && <NewAccount ledger={ledger} onDone={done} />}
      {tool === "policies" && <Policies ledger={ledger} onDone={done} />}
      {tool === "coverage" && <Coverage ledger={ledger} />}
      {tool === null && (
        <p className="text-xs text-ink-faint">Create accounts, set the ledger's policies, check coverage of customer money.</p>
      )}
    </Card>
  );
}
