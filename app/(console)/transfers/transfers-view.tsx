// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/**
 * FX quotes (an immutable rate between two assets) and transfers between two
 * ledgers of the tenant (two posted transactions written atomically, tied by
 * due-to / due-from accounts). Neither has a list in the API, so each card
 * shows what was created or looked up in this visit.
 */

import { useEffect, useState } from "react";
import { DemoBadge } from "@/components/demo-badge";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { useLiveData } from "@/components/live";
import {
  isBalanced,
  PostingsEditor,
  rowsFilled,
  toPostings,
  twoRows,
} from "@/components/postings-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasSession } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import {
  apiErrorText,
  createFxQuote,
  createLedgerTransfer,
  getFxQuote,
  getLedgerTransfer,
  listAccounts,
  listLedgers,
  newIdempotencyKey,
  type ApiAccount,
  type ApiFxQuote,
  type ApiLedger,
  type ApiLedgerTransfer,
} from "@/lib/live";

function FxQuotes({ onNotice }: { onNotice: (m: string) => void }) {
  const [base, setBase] = useState("USD");
  const [quote, setQuote] = useState("EUR");
  const [rate, setRate] = useState("");
  const [source, setSource] = useState("desk");
  const [minutes, setMinutes] = useState("5");
  const [found, setFound] = useState<ApiFxQuote[]>([]);
  const [lookup, setLookup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = /^\d{1,20}(\.\d{1,18})?$/.test(rate) && Number(rate) > 0 && base.trim() && quote.trim() && /^\d+$/.test(minutes) && Number(minutes) > 0;
  const add = (q: ApiFxQuote) => setFound((f) => [q, ...f.filter((x) => x.id !== q.id)]);

  return (
    <Card title="FX quotes" subtitle="1 unit of the base asset = rate units of the quote asset (major units). A quote is a rate, not an execution; it cannot be changed.">
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Base asset"><input className={inputClass} value={base} maxLength={16} onChange={(e) => setBase(e.target.value)} /></Field>
        <Field label="Quote asset"><input className={inputClass} value={quote} maxLength={16} onChange={(e) => setQuote(e.target.value)} /></Field>
        <Field label="Rate"><input className={inputClass} inputMode="decimal" value={rate} placeholder="0.9213" onChange={(e) => setRate(e.target.value)} /></Field>
        <Field label="Source"><input className={inputClass} value={source} onChange={(e) => setSource(e.target.value)} /></Field>
        <Field label="Valid for (minutes)"><input className={inputClass} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
      </div>
      <ErrorLine message={error} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!ok || busy} onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const q = await createFxQuote({
              base_asset: base.trim().toUpperCase(),
              quote_asset: quote.trim().toUpperCase(),
              rate,
              source: source.trim() || "console",
              expires_at: new Date(Date.now() + Number(minutes) * 60_000).toISOString(),
            });
            add(q);
            onNotice(`Quote ${q.id} created.`);
          } catch (e) {
            setError(apiErrorText(e));
          } finally {
            setBusy(false);
          }
        }}>{busy ? "Creating…" : "Create quote"}</Button>
        <input className={`${inputClass} w-72`} placeholder="Look up a quote by id" value={lookup} onChange={(e) => setLookup(e.target.value.trim())} />
        <Button size="sm" variant="outline" disabled={!lookup} onClick={async () => {
          setError(null);
          try {
            add(await getFxQuote(lookup));
            setLookup("");
          } catch (e) {
            setError(apiErrorText(e));
          }
        }}>Find</Button>
      </div>
      <ul className="mt-3 divide-y divide-edge text-xs">
        {found.map((q) => (
          <li key={q.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="font-mono text-ink">{q.id}</span>
            <span>1 {q.base_asset} = <span className="num text-ink">{q.rate}</span> {q.quote_asset} · {q.source} · expires {formatDateTime(q.expires_at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Side({
  title,
  ledgers,
  ledgerId,
  setLedgerId,
  due,
  setDue,
  rows,
  setRows,
}: {
  title: string;
  ledgers: ApiLedger[];
  ledgerId: string;
  setLedgerId: (v: string) => void;
  due: string;
  setDue: (v: string) => void;
  rows: ReturnType<typeof twoRows>;
  setRows: (r: ReturnType<typeof twoRows>) => void;
}) {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  useEffect(() => {
    if (ledgerId) listAccounts(ledgerId).then((p) => setAccounts(p.data), () => setAccounts([]));
  }, [ledgerId]);
  return (
    <div className="space-y-3 rounded-lg border border-edge p-4">
      <p className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ledger">
          <select className={inputClass} value={ledgerId} onChange={(e) => { setLedgerId(e.target.value); setDue(""); }}>
            {ledgers.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
          </select>
        </Field>
        <Field label="Due-to / due-from account">
          <select className={inputClass} value={due} onChange={(e) => setDue(e.target.value)}>
            <option value="">Choose…</option>
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </Field>
      </div>
      <PostingsEditor rows={rows} setRows={setRows} accounts={accounts} />
    </div>
  );
}

function LedgerTransfers({ ledgers, onNotice }: { ledgers: ApiLedger[]; onNotice: (m: string) => void }) {
  const [srcLedger, setSrcLedger] = useState(ledgers[0]?.id ?? "");
  const [dstLedger, setDstLedger] = useState(ledgers[1]?.id ?? ledgers[0]?.id ?? "");
  const [srcDue, setSrcDue] = useState("");
  const [dstDue, setDstDue] = useState("");
  const [srcRows, setSrcRows] = useState(twoRows);
  const [dstRows, setDstRows] = useState(twoRows);
  const [reference, setReference] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [fxAccount, setFxAccount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [key] = useState(() => newIdempotencyKey("xfer"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<ApiLedgerTransfer[]>([]);
  const [lookup, setLookup] = useState("");

  const ok = srcLedger !== dstLedger && srcDue && dstDue && rowsFilled(srcRows) && isBalanced(srcRows) && rowsFilled(dstRows) && isBalanced(dstRows) && (quoteId === "") === (fxAccount === "");
  const add = (t: ApiLedgerTransfer) => setFound((f) => [t, ...f.filter((x) => x.id !== t.id)]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const t = await createLedgerTransfer({
        idempotency_key: key,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        source: { ledger_id: srcLedger, due_account_id: srcDue, postings: toPostings(srcRows) },
        target: { ledger_id: dstLedger, due_account_id: dstDue, postings: toPostings(dstRows) },
        ...(quoteId ? { fx: { quote_id: quoteId.trim(), account_id: fxAccount.trim() } } : {}),
      });
      add(t);
      onNotice(`Transfer ${t.id} posted in both ledgers.`);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card title="Transfer between ledgers" subtitle="Two posted transactions, one per ledger, written atomically. Each side balances on its own; the due accounts must offset each other.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Side title="Source" ledgers={ledgers} ledgerId={srcLedger} setLedgerId={setSrcLedger} due={srcDue} setDue={setSrcDue} rows={srcRows} setRows={setSrcRows} />
        <Side title="Target" ledgers={ledgers} ledgerId={dstLedger} setLedgerId={setDstLedger} due={dstDue} setDue={setDstDue} rows={dstRows} setRows={setDstRows} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Reference"><input className={inputClass} value={reference} maxLength={255} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="FX quote id (only if converting)"><input className={inputClass} value={quoteId} onChange={(e) => setQuoteId(e.target.value)} /></Field>
        <Field label="Conversion account id (with a quote)"><input className={inputClass} value={fxAccount} onChange={(e) => setFxAccount(e.target.value)} /></Field>
      </div>
      {srcLedger === dstLedger && <p className="mt-2 text-xs text-danger">Source and target must be different ledgers.</p>}
      <ErrorLine message={error} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!confirming ? (
          <Button size="sm" disabled={!ok || busy} onClick={() => setConfirming(true)}>Transfer…</Button>
        ) : (
          <>
            <span className="text-xs text-ink">Post both sides now? Posted entries are only reversed, not edited.</span>
            <Button size="sm" disabled={busy} onClick={() => void submit()}>{busy ? "Working…" : "Confirm"}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
          </>
        )}
        <input className={`${inputClass} w-72`} placeholder="Look up a transfer by id" value={lookup} onChange={(e) => setLookup(e.target.value.trim())} />
        <Button size="sm" variant="outline" disabled={!lookup} onClick={async () => {
          setError(null);
          try {
            add(await getLedgerTransfer(lookup));
            setLookup("");
          } catch (e) {
            setError(apiErrorText(e));
          }
        }}>Find</Button>
      </div>
      <ul className="mt-3 divide-y divide-edge text-xs">
        {found.map((t) => (
          <li key={t.id} className="py-2">
            <span className="font-mono text-ink">{t.id}</span>
            <span className="ml-2 text-ink-faint">source {t.source.transaction.id} → target {t.target.transaction.id}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TransfersView() {
  const state = useLiveData(async () => (await listLedgers()).data);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">FX and transfers</h1>
          <p className="mt-0.5 text-sm text-ink-faint">Rate quotes and value moved between ledgers</p>
        </div>
        <DemoBadge demo={state.status === "demo"} />
      </div>
      <Notice message={notice} />
      {state.status === "demo" && !hasSession() && (
        <Card><p className="py-6 text-center text-sm text-ink-muted">Sign in to create quotes and transfers.</p></Card>
      )}
      {state.status === "live" && (
        <>
          <FxQuotes onNotice={setNotice} />
          {state.data.length >= 2 ? (
            <LedgerTransfers ledgers={state.data} onNotice={setNotice} />
          ) : (
            <Card><p className="text-sm text-ink-muted">A transfer needs two ledgers; this tenant has {state.data.length}.</p></Card>
          )}
        </>
      )}
    </div>
  );
}
