// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Reconciliation against the real service: per-source report and runs,
 * discrepancy triage (status, severity, owner, note) and the sources with
 * their CSV imports, custody balances, settlement batches, match rules and
 * callback secret. Shown when a session exists; the demo page stays for
 * visitors.
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { JsonCard } from "@/components/json-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { apiErrorText } from "@/lib/live";
import {
  createCustodyBalance,
  createMatchRule,
  createRun,
  createSettlementBatch,
  createSource,
  getReports,
  importCsv,
  listDiscrepancies,
  listSourceItems,
  listSources,
  rotateCallbackSecret,
  updateDiscrepancy,
  type DiscrepancyStatus,
  type ReconDiscrepancy,
  type ReconReport,
  type ReconSource,
  type Severity,
  type SourceKind,
} from "@/lib/recon";

const SEV_TONE: Record<Severity, BadgeTone> = { low: "slate", medium: "sky", high: "amber", critical: "red" };
const STATUSES: DiscrepancyStatus[] = ["open", "investigating", "resolved"];
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

type Tab = "overview" | "discrepancies" | "sources";

function Overview({ sources, onNotice }: { sources: ReconSource[]; onNotice: (m: string) => void }) {
  const [report, setReport] = useState<ReconReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [ruleVersion, setRuleVersion] = useState("");

  useEffect(() => {
    getReports().then(setReport, (e) => setError(apiErrorText(e)));
  }, [version]);

  return (
    <Card title="Report" subtitle="Matched, unmatched and open discrepancies per source" flush>
      <ErrorLine message={error} />
      {report && (
        <>
          <p className="border-b border-edge px-5 py-3 text-xs text-ink-muted">
            Totals: {report.totals.matched} matched · {report.totals.unmatched} unmatched · {report.totals.disputed} disputed ·{" "}
            {report.totals.open_discrepancies} open discrepancies ({report.totals.overdue_discrepancies} overdue)
          </p>
          <Table>
            <THead>
              <TH>Source</TH>
              <TH className="text-right">Matched</TH>
              <TH className="text-right">Unmatched</TH>
              <TH className="text-right">Disputed</TH>
              <TH className="text-right">Open</TH>
              <TH className="text-right">Overdue</TH>
              <TH><span className="sr-only">Run</span></TH>
            </THead>
            <TBody>
              {report.data.length === 0 && (<TR><TD colSpan={7} className="py-8 text-center text-ink-faint">No sources yet. Add one in the Sources tab.</TD></TR>)}
              {report.data.map((r) => (
                <TR key={r.source_id}>
                  <TD className="font-mono text-xs text-ink">{r.source_name}</TD>
                  <TD className="num text-right">{r.matched}</TD>
                  <TD className="num text-right">{r.unmatched}</TD>
                  <TD className="num text-right">{r.disputed}</TD>
                  <TD className="num text-right">{r.open_discrepancies}</TD>
                  <TD className={`num text-right ${r.overdue_discrepancies ? "text-danger" : ""}`}>{r.overdue_discrepancies}</TD>
                  <TD className="text-right">
                    {pending === r.source_id ? (
                      <span className="flex items-center justify-end gap-2">
                        <input className={`${inputClass} w-28`} inputMode="numeric" placeholder="rule version" value={ruleVersion} onChange={(e) => setRuleVersion(e.target.value.replace(/\D/g, ""))} />
                        <Button size="sm" onClick={async () => {
                          setError(null);
                          try {
                            const run = await createRun(r.source_id, ruleVersion ? Number(ruleVersion) : undefined);
                            onNotice(`Run ${run.id}: ${run.status}, ${run.matched_count} matched, ${run.unmatched_count} unmatched.`);
                            setPending(null);
                            setVersion((v) => v + 1);
                          } catch (e) {
                            setError(apiErrorText(e));
                          }
                        }}>Confirm run</Button>
                        <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Back</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={!sources.some((s) => s.id === r.source_id)} onClick={() => setPending(r.source_id)}>Run…</Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}
    </Card>
  );
}

function DiscrepancyRow({ d, onSaved }: { d: ReconDiscrepancy; onSaved: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(d.status);
  const [severity, setSeverity] = useState(d.severity);
  const [owner, setOwner] = useState(d.owner ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const changed = status !== d.status || severity !== d.severity || owner !== (d.owner ?? "") || note.trim() !== "";

  return (
    <>
      <TR onClick={() => setOpen(!open)} selected={open}>
        <TD className="font-mono text-xs text-ink">{d.kind}</TD>
        <TD><Badge tone={SEV_TONE[d.severity]}>{d.severity}</Badge></TD>
        <TD>{d.status}</TD>
        <TD className="font-mono text-xs">{d.owner ?? "—"}</TD>
        <TD className={`text-xs whitespace-nowrap ${d.sla_breached ? "text-danger" : ""}`}>{formatDateTime(d.due_at)}</TD>
      </TR>
      {open && (
        <TR>
          <TD colSpan={5}>
            <div className="space-y-3">
              <pre className="max-h-48 overflow-auto font-mono text-[11px] text-ink-muted">{JSON.stringify(d.details, null, 2)}</pre>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Status"><select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as DiscrepancyStatus)}>{STATUSES.map((s) => (<option key={s}>{s}</option>))}</select></Field>
                <Field label="Severity"><select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>{SEVERITIES.map((s) => (<option key={s}>{s}</option>))}</select></Field>
                <Field label="Owner (handle, never an email)"><input className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
                <Field label="Resolution note"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              </div>
              <ErrorLine message={error} />
              <Button size="sm" disabled={!changed} onClick={async () => {
                setError(null);
                try {
                  await updateDiscrepancy(d.id, {
                    ...(status !== d.status ? { status } : {}),
                    ...(severity !== d.severity ? { severity } : {}),
                    ...(owner !== (d.owner ?? "") ? { owner } : {}),
                    ...(note.trim() ? { resolution_note: note.trim() } : {}),
                  });
                  onSaved(`Discrepancy ${d.id} updated.`);
                } catch (e) {
                  setError(apiErrorText(e));
                }
              }}>Save triage</Button>
            </div>
          </TD>
        </TR>
      )}
    </>
  );
}

function Discrepancies({ onNotice }: { onNotice: (m: string) => void }) {
  const [status, setStatus] = useState<"" | DiscrepancyStatus>("open");
  const [severity, setSeverity] = useState<"" | Severity>("");
  const [overdue, setOverdue] = useState(false);
  const [owner, setOwner] = useState("");
  const [rows, setRows] = useState<ReconDiscrepancy[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const filters = { status: status || undefined, severity: severity || undefined, owner: owner.trim() || undefined, overdue };

  useEffect(() => {
    listDiscrepancies({ status: status || undefined, severity: severity || undefined, owner: owner.trim() || undefined, overdue }).then(
      (p) => {
        setRows(p.data);
        setCursor(p.next_cursor ?? null);
        setError(null);
      },
      (e) => setError(apiErrorText(e)),
    );
  }, [status, severity, overdue, owner, version]);

  return (
    <Card title="Discrepancies" subtitle="Newest first. Click a row to triage it." flush>
      <div className="grid gap-3 border-b border-edge px-5 py-3 sm:grid-cols-4">
        <Field label="Status"><select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="">any</option>{STATUSES.map((s) => (<option key={s}>{s}</option>))}</select></Field>
        <Field label="Severity"><select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}><option value="">any</option>{SEVERITIES.map((s) => (<option key={s}>{s}</option>))}</select></Field>
        <Field label="Owner"><input className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
        <label className="flex items-center gap-2 pt-5 text-xs text-ink-faint"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />Overdue only</label>
      </div>
      <ErrorLine message={error} />
      <Table>
        <THead><TH>Kind</TH><TH>Severity</TH><TH>Status</TH><TH>Owner</TH><TH>Due</TH></THead>
        <TBody>
          {rows.length === 0 && (<TR><TD colSpan={5} className="py-8 text-center text-ink-faint">No discrepancies match.</TD></TR>)}
          {rows.map((d) => (
            <DiscrepancyRow key={d.id} d={d} onSaved={(m) => { onNotice(m); setVersion((v) => v + 1); }} />
          ))}
        </TBody>
      </Table>
      {cursor && (
        <div className="flex justify-center border-t border-edge py-3">
          <Button size="sm" variant="outline" onClick={async () => {
            try {
              const p = await listDiscrepancies(filters, cursor);
              setRows((r) => [...r, ...p.data]);
              setCursor(p.next_cursor ?? null);
            } catch (e) {
              setError(apiErrorText(e));
            }
          }}>Load more</Button>
        </div>
      )}
    </Card>
  );
}

function SourceTools({ source, onNotice }: { source: ReconSource; onNotice: (m: string) => void }) {
  const [list, setList] = useState<{ what: string; items: Record<string, unknown>[] } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmSecret, setConfirmSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custody, setCustody] = useState({ account_id: "", asset: "USD", as_of: "", balance: "" });
  const [file, setFile] = useState<File | null>(null);

  async function show(what: "match-rules" | "custody-balances" | "settlement-batches" | "callbacks") {
    setError(null);
    try {
      setList({ what, items: (await listSourceItems(source.id, what)).data });
    } catch (e) {
      setError(apiErrorText(e));
    }
  }

  return (
    <div className="space-y-4 border-t border-edge py-4">
      <div className="flex flex-wrap gap-2">
        {(["match-rules", "custody-balances", "settlement-batches", "callbacks"] as const).map((w) => (
          <Button key={w} size="sm" variant={list?.what === w ? "primary" : "outline"} onClick={() => void show(w)}>{w.replace("-", " ")}</Button>
        ))}
        {confirmSecret ? (
          <>
            <span className="text-xs text-ink">Rotate the callback secret? The new one is shown once.</span>
            <Button size="sm" onClick={async () => {
              try {
                const r = await rotateCallbackSecret(source.id);
                setSecret(r.secret);
                setConfirmSecret(false);
              } catch (e) {
                setError(apiErrorText(e));
              }
            }}>Confirm</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmSecret(false)}>Back</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmSecret(true)}>Rotate callback secret…</Button>
        )}
      </div>
      {secret && (
        <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="text-ink">Copy the callback secret now. It is not shown again.</p>
          <code className="mt-1 block font-mono break-all text-ink">{secret}</code>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSecret(null)}>I saved it</Button>
        </div>
      )}
      <ErrorLine message={error} />
      {list && (
        <pre className="max-h-64 overflow-auto rounded-md border border-edge bg-[#04070c] p-3 font-mono text-[11px] text-ink-muted">
          {list.items.length === 0 ? "Nothing yet." : JSON.stringify(list.items, null, 2)}
        </pre>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Import a CSV statement</p>
          <p className="text-xs text-ink-faint">Columns: external_ref, amount (decimal), asset, occurred_at (RFC 3339).</p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs text-ink-muted" />
          <Button size="sm" variant="outline" disabled={!file} onClick={async () => {
            if (!file) return;
            setError(null);
            try {
              const r = await importCsv(source.id, file);
              onNotice(`Import ${String(r.id)}: ${String(r.status)}, ${String(r.row_count)} rows.`);
              setFile(null);
            } catch (e) {
              setError(apiErrorText(e));
            }
          }}>Import</Button>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Report a custody balance</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Account id"><input className={inputClass} value={custody.account_id} onChange={(e) => setCustody({ ...custody, account_id: e.target.value.trim() })} /></Field>
            <Field label="Asset"><input className={inputClass} value={custody.asset} onChange={(e) => setCustody({ ...custody, asset: e.target.value })} /></Field>
            <Field label="As of"><input type="datetime-local" className={inputClass} value={custody.as_of} onChange={(e) => setCustody({ ...custody, as_of: e.target.value })} /></Field>
            <Field label="Balance (minor units)"><input className={inputClass} value={custody.balance} onChange={(e) => setCustody({ ...custody, balance: e.target.value.replace(/[^\d-]/g, "") })} /></Field>
          </div>
          <Button size="sm" variant="outline" disabled={!custody.account_id || !custody.as_of || !/^-?\d+$/.test(custody.balance)} onClick={async () => {
            setError(null);
            try {
              await createCustodyBalance(source.id, { ...custody, asset: custody.asset.trim().toUpperCase(), as_of: new Date(custody.as_of).toISOString() });
              onNotice("Custody balance recorded.");
            } catch (e) {
              setError(apiErrorText(e));
            }
          }}>Record balance</Button>
        </div>
      </div>

      <JsonCard
        title="Settlement batch"
        subtitle="What the PSP reports for one payout: gross, fees, chargebacks and refunds in minor units."
        template={JSON.stringify({ batch_ref: "stl_0001", account_id: "", asset: "USD", gross: "10000", fees: "300", chargebacks: "0", refunds: "0" }, null, 2)}
        submitLabel="Record batch"
        confirmText="Record this settlement batch?"
        onSubmit={(b) => createSettlementBatch(source.id, b)}
        onDone={() => onNotice("Settlement batch recorded.")}
      />
      <JsonCard
        title="Match rule version"
        subtitle="How statement rows are matched to ledger entries (cardinality, group_by, account_id, amount_tolerance)."
        template={JSON.stringify({ cardinality: "one_to_one", group_by: "reference", amount_tolerance: "0" }, null, 2)}
        submitLabel="Publish match rule"
        confirmText="Publish this match rule version?"
        onSubmit={(b) => createMatchRule(source.id, b)}
        onDone={() => onNotice("Match rule published.")}
      />
    </div>
  );
}

function Sources({ sources, reload, onNotice }: { sources: ReconSource[]; reload: () => void; onNotice: (m: string) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SourceKind>("bank");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Card title="New source" subtitle="A bank, PSP, provider or manual feed to reconcile against.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name"><input className={inputClass} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Kind"><select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>{(["bank", "psp", "provider", "manual"] as const).map((k) => (<option key={k}>{k}</option>))}</select></Field>
          <div className="flex items-end"><Button size="sm" disabled={!name.trim()} onClick={async () => {
            setError(null);
            try {
              const s = await createSource({ name: name.trim(), kind });
              setName("");
              onNotice(`Source ${s.name} created.`);
              reload();
            } catch (e) {
              setError(apiErrorText(e));
            }
          }}>Create source</Button></div>
        </div>
        <ErrorLine message={error} />
      </Card>
      <Card title="Sources">
        {sources.length === 0 && <p className="text-sm text-ink-faint">No sources yet.</p>}
        <ul>
          {sources.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center justify-between py-3 text-left text-sm">
                <span><span className="font-mono text-ink">{s.name}</span> <Badge tone="slate">{s.kind}</Badge></span>
                <span className="text-xs text-ink-faint">{open === s.id ? "Hide" : "Manage"}</span>
              </button>
              {open === s.id && <SourceTools source={s} onNotice={onNotice} />}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export function ReconLive() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sources, setSources] = useState<ReconSource[]>([]);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSources().then((p) => setSources(p.data), (e) => setError(apiErrorText(e)));
  }, [version]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Reconciliation</h1>
        <p className="mt-0.5 text-sm text-ink-faint">Match external statements against the ledger and triage what does not match</p>
      </div>
      <div role="group" aria-label="Reconciliation" className="flex gap-1.5">
        {(["overview", "discrepancies", "sources"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`inline-flex h-9 items-center rounded-(--radius-control) border px-3 text-xs font-medium ${tab === t ? "border-accent/60 bg-accent-soft text-accent" : "border-edge-strong text-ink-muted hover:text-ink"}`}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <Notice message={notice} />
      <ErrorLine message={error} />
      {tab === "overview" && <Overview sources={sources} onNotice={setNotice} />}
      {tab === "discrepancies" && <Discrepancies onNotice={setNotice} />}
      {tab === "sources" && <Sources sources={sources} reload={() => setVersion((v) => v + 1)} onNotice={setNotice} />}
    </div>
  );
}
