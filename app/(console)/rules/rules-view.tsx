// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/**
 * Posting rules (an immutable, versioned mapping from an event type to
 * transaction lines), the events that apply them and posting groups. The list
 * is readable; the nested bodies (rules, groups) are written as JSON, the
 * events as a form with the usual parts (amounts, accounts) and JSON for the
 * advanced ones (lists, FX quote, hold, movement).
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { JsonCard } from "@/components/json-card";
import { LedgerScope } from "@/components/ledger-scope";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  apiErrorText,
  createPostingEvent,
  createPostingGroup,
  createPostingRule,
  getPostingEvent,
  getPostingGroup,
  listPostingRules,
  newIdempotencyKey,
  type ApiPostingRule,
} from "@/lib/live";

/** "a=1\nb=2" -> {a:"1", b:"2"}; null when a line has no "=". */
function parsePairs(text: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const i = line.indexOf("=");
    if (i < 1) return null;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function RulesList({ rules }: { rules: ApiPostingRule[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card title="Rules" subtitle="Every version of every rule, newest first" flush>
      <Table>
        <THead>
          <TH>Event type</TH>
          <TH>Version</TH>
          <TH>Description</TH>
          <TH className="text-right">Lines</TH>
          <TH>Created</TH>
        </THead>
        <TBody>
          {rules.length === 0 && (
            <TR><TD colSpan={5} className="py-8 text-center text-ink-faint">No rules in this ledger.</TD></TR>
          )}
          {rules.flatMap((r) => [
            <TR key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} selected={open === r.id}>
              <TD className="font-mono text-xs text-ink">{r.event_type}</TD>
              <TD className="num">{r.version}</TD>
              <TD>{r.description ?? "—"}</TD>
              <TD className="num text-right">{r.lines.length}</TD>
              <TD className="text-xs">{formatDateTime(r.created_at)}</TD>
            </TR>,
            ...(open === r.id
              ? [
                  <TR key={`${r.id}-d`}>
                    <TD colSpan={5}>
                      <pre className="overflow-x-auto font-mono text-[11px] text-ink-muted">
                        {JSON.stringify({ id: r.id, rule_hash: r.rule_hash, computed: r.computed, fx: r.fx, lines: r.lines }, null, 2)}
                      </pre>
                    </TD>
                  </TR>,
                ]
              : []),
          ])}
        </TBody>
      </Table>
    </Card>
  );
}

function BookEvent({ ledgerId, onDone }: { ledgerId: string; onDone: (m: string) => void }) {
  const [eventType, setEventType] = useState("");
  const [version, setVersion] = useState("");
  const [asset, setAsset] = useState("USD");
  const [amounts, setAmounts] = useState("");
  const [accounts, setAccounts] = useState("");
  const [extra, setExtra] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [key] = useState(() => newIdempotencyKey("event"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountPairs = parsePairs(amounts);
  const accountPairs = parsePairs(accounts);
  let extraObj: Record<string, unknown> | null = {};
  if (extra.trim()) {
    try {
      const v: unknown = JSON.parse(extra);
      extraObj = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      extraObj = null;
    }
  }
  const ok =
    /^[a-z0-9][a-z0-9._-]{0,63}$/.test(eventType) &&
    amountPairs !== null &&
    Object.values(amountPairs).every((v) => /^-?\d+$/.test(v)) &&
    accountPairs !== null &&
    extraObj !== null &&
    (version === "" || /^\d+$/.test(version));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const ev = await createPostingEvent({
        ledger_id: ledgerId,
        event_type: eventType,
        idempotency_key: key,
        ...(version ? { rule_version: Number(version) } : {}),
        ...(asset.trim() ? { asset: asset.trim().toUpperCase() } : {}),
        amounts: amountPairs,
        accounts: accountPairs,
        ...extraObj,
      });
      onDone(`Event ${String(ev.id)} booked.`);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card title="Book an event" subtitle="Applies the rule of an event type: the amounts and accounts you name become a posted transaction.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Event type"><input className={inputClass} value={eventType} onChange={(e) => setEventType(e.target.value)} /></Field>
        <Field label="Rule version (empty = latest)"><input className={inputClass} inputMode="numeric" value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
        <Field label="Asset"><input className={inputClass} value={asset} onChange={(e) => setAsset(e.target.value)} /></Field>
        <Field label="Amounts, one name=minor units per line">
          <textarea className={`${inputClass} h-24 py-2 font-mono text-xs`} value={amounts} placeholder="gross=10000" onChange={(e) => setAmounts(e.target.value)} />
        </Field>
        <Field label="Accounts, one role=account id per line">
          <textarea className={`${inputClass} h-24 py-2 font-mono text-xs`} value={accounts} placeholder="wallet=0f5a..." onChange={(e) => setAccounts(e.target.value)} />
        </Field>
        <Field label="Advanced JSON (lists, fx_quote_id, hold_id, movement, metadata)">
          <textarea className={`${inputClass} h-24 py-2 font-mono text-xs`} value={extra} onChange={(e) => setExtra(e.target.value)} />
        </Field>
      </div>
      {(amountPairs === null || accountPairs === null) && <p className="mt-2 text-xs text-danger">Each line must look like name=value.</p>}
      {extraObj === null && <p className="mt-2 text-xs text-danger">The advanced part must be a JSON object.</p>}
      <ErrorLine message={error} />
      <div className="mt-3 flex items-center gap-2">
        {!confirming ? (
          <Button size="sm" disabled={!ok || busy} onClick={() => setConfirming(true)}>Book…</Button>
        ) : (
          <>
            <span className="text-xs text-ink">Book this event? It posts a transaction.</span>
            <Button size="sm" disabled={busy} onClick={() => void submit()}>{busy ? "Working…" : "Confirm"}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Lookup() {
  const [kind, setKind] = useState<"event" | "group">("event");
  const [id, setId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title="Look up an event or group">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputClass} w-40`} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="event">posting event</option>
          <option value="group">posting group</option>
        </select>
        <input className={`${inputClass} w-80`} placeholder="id" value={id} onChange={(e) => setId(e.target.value.trim())} />
        <Button size="sm" variant="outline" disabled={!id} onClick={async () => {
          setError(null);
          try {
            setResult(await (kind === "event" ? getPostingEvent(id) : getPostingGroup(id)));
          } catch (e) {
            setError(apiErrorText(e));
          }
        }}>Find</Button>
      </div>
      <ErrorLine message={error} />
      {result && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-edge bg-code p-3 font-mono text-[11px] text-ink-muted">{JSON.stringify(result, null, 2)}</pre>
      )}
    </Card>
  );
}

function RulesBody({ ledgerId }: { ledgerId: string }) {
  const [rules, setRules] = useState<ApiPostingRule[]>([]);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPostingRules(ledgerId).then(
      (p) => setRules(p.data),
      (e) => setError(apiErrorText(e)),
    );
  }, [ledgerId, version]);

  const ruleTemplate = JSON.stringify(
    {
      ledger_id: ledgerId,
      event_type: "deposit",
      description: "Customer deposit",
      lines: [
        { direction: "DEBIT", account: "cash", amount: "gross" },
        { direction: "CREDIT", account: "wallet", amount: "gross" },
      ],
    },
    null,
    2,
  );
  const groupTemplate = JSON.stringify(
    { ledger_id: ledgerId, idempotency_key: newIdempotencyKey("group"), transactions: [] },
    null,
    2,
  );

  return (
    <>
      <Notice message={notice} />
      <ErrorLine message={error} />
      <RulesList rules={rules} />
      <JsonCard
        title="New rule version"
        subtitle="Rules are immutable: a change is a new version of the event type. The template shows the shape; see the API reference for lines, computed amounts and fx."
        template={ruleTemplate}
        submitLabel="Publish rule"
        confirmText="Publish this rule version? It cannot be edited afterwards."
        onSubmit={(b) => createPostingRule(b) as unknown as Promise<Record<string, unknown>>}
        onDone={() => {
          setNotice("Rule published.");
          setVersion((v) => v + 1);
        }}
      />
      <BookEvent ledgerId={ledgerId} onDone={setNotice} />
      <JsonCard
        title="New posting group"
        subtitle="Several transactions committed together, optionally priced with an FX quote."
        template={groupTemplate}
        submitLabel="Create group"
        confirmText="Post every transaction of the group now?"
        onSubmit={createPostingGroup}
        onDone={() => setNotice("Posting group created.")}
      />
      <Lookup />
    </>
  );
}

export function RulesView() {
  return (
    <LedgerScope
      title="Posting rules"
      subtitle="Rules, events and groups that turn business events into entries"
      demoNote="Sign in to manage the posting rules of your ledgers."
    >
      {(ledger) => <RulesBody ledgerId={ledger.id} />}
    </LedgerScope>
  );
}
