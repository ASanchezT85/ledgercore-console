// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * The tenant's audit log (hash-chained) with filters, and the verification of
 * the chain: the API recomputes every link and reports where one breaks.
 */

import { useEffect, useState } from "react";
import { DemoBadge } from "@/components/demo-badge";
import { ErrorLine, Field, inputClass } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  apiErrorText,
  listAuditLog,
  verifyAuditLog,
  type ApiAuditEntry,
  type ApiAuditVerification,
  type AuditFilters,
} from "@/lib/live";
import { hasSession } from "@/lib/session";

function Verify() {
  const [result, setResult] = useState<ApiAuditVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card
      title="Chain verification"
      subtitle="Recomputes every entry's hash and its link to the previous one."
      actions={
        <Button size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            setResult(await verifyAuditLog());
          } catch (e) {
            setError(apiErrorText(e));
          } finally {
            setBusy(false);
          }
        }}>{busy ? "Verifying…" : "Verify chain"}</Button>
      }
    >
      <ErrorLine message={error} />
      {result && (
        <div className="space-y-2 text-xs">
          <Badge tone={result.ok ? "emerald" : "red"} dot>{result.ok ? "chain intact" : `${result.breaks.length} break(s)`}</Badge>
          <p className="text-ink-faint">
            Head: entry #{result.head.chain_seq}
            {result.head.occurred_at ? ` at ${formatDateTime(result.head.occurred_at)}` : ""} ·{" "}
            <code className="font-mono">{result.head.entry_hash.slice(0, 16)}…</code>
          </p>
          {result.breaks.map((b) => (
            <p key={`${b.chain_seq}/${b.problem}`} className="text-danger">
              #{b.chain_seq} {b.problem}: stored {b.stored.slice(0, 16)}, expected {b.expected.slice(0, 16)}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AuditView() {
  // Read after mount so server and client render the same first frame.
  const [live, setLive] = useState(false);
  useEffect(() => setLive(hasSession()), []);
  const [draft, setDraft] = useState({ from: "", to: "", action: "", resource_type: "", resource_id: "" });
  const [filters, setFilters] = useState<AuditFilters>({});
  const [rows, setRows] = useState<ApiAuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!live) return;
    listAuditLog(filters).then(
      (p) => {
        setRows(p.data);
        setCursor(p.next_cursor ?? null);
        setError(null);
      },
      (e) => setError(apiErrorText(e)),
    );
  }, [filters, live]);

  function apply() {
    const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
    setFilters({
      from: iso(draft.from),
      to: iso(draft.to),
      action: draft.action.trim() || undefined,
      resource_type: draft.resource_type.trim() || undefined,
      resource_id: draft.resource_id.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">Audit log</h1>
          <p className="mt-0.5 text-sm text-ink-faint">Who did what, in chain order</p>
        </div>
        <DemoBadge demo={!live} />
      </div>
      {!live && (
        <Card><p className="py-6 text-center text-sm text-ink-muted">Sign in to read your audit log.</p></Card>
      )}
      {live && (
        <>
          <Verify />
          <Card title="Entries" flush>
            <form className="grid gap-3 border-b border-edge px-5 py-3 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); apply(); }}>
              <Field label="From"><input type="datetime-local" className={inputClass} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
              <Field label="To"><input type="datetime-local" className={inputClass} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
              <Field label="Action"><input className={inputClass} placeholder="account.update" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} /></Field>
              <Field label="Resource type"><input className={inputClass} value={draft.resource_type} onChange={(e) => setDraft({ ...draft, resource_type: e.target.value })} /></Field>
              <Field label="Resource id"><input className={inputClass} value={draft.resource_id} onChange={(e) => setDraft({ ...draft, resource_id: e.target.value })} /></Field>
              <div className="flex items-end"><Button type="submit" size="sm" variant="outline">Apply</Button></div>
            </form>
            <ErrorLine message={error} />
            <Table>
              <THead>
                <TH>#</TH>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Resource</TH>
              </THead>
              <TBody>
                {rows.length === 0 && (
                  <TR><TD colSpan={5} className="py-8 text-center text-ink-faint">No entries.</TD></TR>
                )}
                {rows.flatMap((r) => [
                  <TR key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} selected={open === r.id}>
                    <TD className="num text-xs">{r.chain_seq}</TD>
                    <TD className="text-xs whitespace-nowrap">{formatDateTime(r.occurred_at)}</TD>
                    <TD className="font-mono text-xs">{r.actor}</TD>
                    <TD className="font-mono text-xs text-ink">{r.action}</TD>
                    <TD className="font-mono text-xs">{r.resource_type} {r.resource_id}</TD>
                  </TR>,
                  ...(open === r.id
                    ? [
                        <TR key={`${r.id}-detail`}>
                          <TD colSpan={5}>
                            <pre className="overflow-x-auto font-mono text-[11px] whitespace-pre-wrap text-ink-muted">
{JSON.stringify({ before: r.before, after: r.after, request_id: r.request_id, entry_hash: r.entry_hash }, null, 2)}
                            </pre>
                          </TD>
                        </TR>,
                      ]
                    : []),
                ])}
              </TBody>
            </Table>
            {cursor && (
              <div className="flex justify-center border-t border-edge py-3">
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    const p = await listAuditLog(filters, cursor);
                    setRows((r) => [...r, ...p.data]);
                    setCursor(p.next_cursor ?? null);
                  } catch (e) {
                    setError(apiErrorText(e));
                  }
                }}>Load more</Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
