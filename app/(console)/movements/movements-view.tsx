// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/**
 * Staged movements (6.36): the list with status filters and per-asset figures,
 * the margin summary of the movements closed in a period, opening a movement
 * (or a return of a completed one) and closing one with an outcome.
 */

import { useCallback, useEffect, useState } from "react";
import { LedgerScope } from "@/components/ledger-scope";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime, formatMoneyWithAsset } from "@/lib/format";
import {
  ApiError,
  assetExponent,
  closeMovement,
  listMovements,
  newIdempotencyKey,
  openMovement,
  summarizeMovements,
  type ApiMovement,
  type MovementStatus,
  type MovementSummaryRow,
} from "@/lib/live";

const STATUS_TONE: Record<MovementStatus, BadgeTone> = {
  open: "sky",
  authorized: "sky",
  captured: "sky",
  dispatched: "sky",
  completed: "emerald",
  failed: "red",
  cancelled: "slate",
};

const FILTER_STATUSES = [
  "",
  "open",
  "completed",
  "failed",
  "cancelled",
  "authorized",
  "captured",
  "dispatched",
] as const;

const inputClass =
  "h-9 w-full rounded-(--radius-control) border border-edge-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint";

const signed = (v: string, asset: string) =>
  formatMoneyWithAsset(BigInt(v), asset, assetExponent(asset));

function errorText(err: unknown): string {
  if (err instanceof ApiError)
    return `${err.code}${err.apiMessage ? ` — ${err.apiMessage}` : ""}`;
  return err instanceof Error ? err.message : "unknown_error";
}

const ended = (m: ApiMovement) => m.closed_at !== null;

/** `<input type="datetime-local">` value -> RFC 3339 (UTC), "" when empty. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

function SummaryCard({ ledgerId }: { ledgerId: string }) {
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 16),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [rows, setRows] = useState<MovementSummaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    try {
      const res = await summarizeMovements({
        ledger_id: ledgerId,
        from: toIso(from),
        to: toIso(to),
      });
      setRows(res.data);
    } catch (err) {
      setError(errorText(err));
    }
  }, [ledgerId, from, to]);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      title="Margin summary"
      subtitle="Revenue, cost and margin of the movements closed in the period, by type and asset"
      actions={
        <span className="flex items-end gap-2">
          <label className="text-[11px] text-ink-faint">
            From
            <input
              type="datetime-local"
              className={inputClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-[11px] text-ink-faint">
            To
            <input
              type="datetime-local"
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => void run()}>
            Apply
          </Button>
        </span>
      }
      flush
    >
      {error && <p className="px-5 py-4 text-xs text-danger">{error}</p>}
      {rows && (
        <Table>
          <THead>
            <TH>Type</TH>
            <TH>Asset</TH>
            <TH className="text-right">Movements</TH>
            <TH className="text-right">Revenue</TH>
            <TH className="text-right">Cost</TH>
            <TH className="text-right">Margin</TH>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-8 text-center text-ink-faint">
                  No movement closed in this period.
                </TD>
              </TR>
            )}
            {rows.map((r) => (
              <TR key={`${r.type}/${r.asset}`}>
                <TD className="font-mono text-xs text-ink">{r.type}</TD>
                <TD>{r.asset}</TD>
                <TD className="num text-right">{r.movements}</TD>
                <TD className="num text-right">{signed(r.revenue, r.asset)}</TD>
                <TD className="num text-right">{signed(r.cost, r.asset)}</TD>
                <TD
                  className={`num text-right font-medium ${
                    r.margin.startsWith("-") ? "text-danger" : "text-accent"
                  }`}
                >
                  {signed(r.margin, r.asset)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function OpenForm({
  ledgerId,
  parentId,
  onOpened,
  onCancel,
}: {
  ledgerId: string;
  parentId?: string;
  onOpened: (m: ApiMovement) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(parentId ? "refund" : "");
  const [reference, setReference] = useState("");
  const [key] = useState(() => newIdempotencyKey("movement"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onOpened(
        await openMovement({
          ledger_id: ledgerId,
          idempotency_key: key,
          type: type.trim(),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(parentId ? { parent_movement_id: parentId } : {}),
        }),
      );
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Card
      title={parentId ? "Open a return" : "Open a movement"}
      subtitle={
        parentId
          ? `A refund or chargeback of the completed movement ${parentId}.`
          : "One operation of yours in this ledger, such as a remittance or a payroll run."
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-ink-faint">
          Type (lowercase label, e.g. remittance)
          <input
            className={inputClass}
            value={type}
            maxLength={64}
            pattern="[a-z0-9][a-z0-9._-]*"
            onChange={(e) => setType(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-ink-faint">
          Reference (your id for the operation, optional)
          <input
            className={inputClass}
            value={reference}
            maxLength={255}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          disabled={busy || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(type)}
          onClick={() => void submit()}
        >
          {busy ? "Opening…" : "Open"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function CloseForm({
  movement,
  onClosed,
  onCancel,
}: {
  movement: ApiMovement;
  onClosed: (m: ApiMovement) => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<"completed" | "failed" | "cancelled">(
    movement.status === "captured" || movement.status === "dispatched"
      ? "completed"
      : "cancelled",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onClosed(await closeMovement(movement.id, outcome));
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Card
      title={`Close movement ${movement.reference ?? movement.id}`}
      subtitle="Ends the movement: its active holds are released and any transit left is recorded as a residual. A closed movement cannot be reopened."
    >
      <label className="space-y-1 text-xs text-ink-faint">
        Outcome
        <select
          className={inputClass}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as typeof outcome)}
        >
          <option value="completed">completed (needs captured)</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? "Closing…" : `Confirm close as ${outcome}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

type Panel =
  | { kind: "open"; parentId?: string }
  | { kind: "close"; movement: ApiMovement };

function MovementList({ ledgerId }: { ledgerId: string }) {
  const [status, setStatus] = useState<(typeof FILTER_STATUSES)[number]>("");
  const [type, setType] = useState("");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<ApiMovement[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMovements({
      ledger_id: ledgerId,
      ...(status ? { status } : {}),
      type: type.trim() || undefined,
      reference: reference.trim() || undefined,
    }).then(
      (page) => {
        if (cancelled) return;
        setRows(page.data);
        setCursor(page.next_cursor ?? null);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(errorText(err));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ledgerId, status, type, reference, version]);

  async function more() {
    if (!cursor) return;
    try {
      const page = await listMovements(
        {
          ledger_id: ledgerId,
          ...(status ? { status } : {}),
          type: type.trim() || undefined,
          reference: reference.trim() || undefined,
        },
        cursor,
      );
      setRows((r) => [...r, ...page.data]);
      setCursor(page.next_cursor ?? null);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <>
      {notice && (
        <p
          role="status"
          className="rounded-(--radius-control) border border-accent/30 bg-accent-soft px-4 py-2 text-sm text-ink"
        >
          {notice}
        </p>
      )}
      <SummaryCard ledgerId={ledgerId} />
      {panel?.kind === "open" && (
        <OpenForm
          ledgerId={ledgerId}
          parentId={panel.parentId}
          onCancel={() => setPanel(null)}
          onOpened={(m) => {
            setNotice(`Opened movement ${m.id} (${m.type}).`);
            setPanel(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {panel?.kind === "close" && (
        <CloseForm
          movement={panel.movement}
          onCancel={() => setPanel(null)}
          onClosed={(m) => {
            setNotice(`Movement ${m.id} is now ${m.status}.`);
            setPanel(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
      <Card
        title="Movements"
        subtitle="Newest first"
        actions={
          <Button size="sm" onClick={() => setPanel({ kind: "open" })}>
            Open movement
          </Button>
        }
        flush
      >
        <div className="grid gap-3 border-b border-edge px-5 py-3 sm:grid-cols-3">
          <label className="space-y-1 text-[11px] text-ink-faint">
            Status
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {FILTER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "" ? "any" : s === "open" ? "open (not ended)" : s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-ink-faint">
            Type
            <input
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-[11px] text-ink-faint">
            Reference (exact)
            <input
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="px-5 py-4 text-xs text-danger">{error}</p>}
        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-faint">Loading…</p>
        ) : (
          <Table>
            <THead>
              <TH>Opened</TH>
              <TH>Type / reference</TH>
              <TH>Status</TH>
              <TH>Figures</TH>
              <TH>Transit residual</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </THead>
            <TBody>
              {rows.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">
                    No movements match.
                  </TD>
                </TR>
              )}
              {rows.map((m) => (
                <TR key={m.id}>
                  <TD className="text-xs">{formatDateTime(m.opened_at)}</TD>
                  <TD>
                    <span className="font-mono text-xs text-ink">{m.type}</span>
                    {m.reference && (
                      <span className="block font-mono text-[11px] text-ink-faint">
                        {m.reference}
                      </span>
                    )}
                    {m.parent_movement_id && (
                      <span className="block text-[11px] text-ink-faint">
                        return of {m.parent_movement_id.slice(0, 8)}…
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                    {m.stale_at && (
                      <Badge tone="amber" className="ml-1">
                        stale
                      </Badge>
                    )}
                  </TD>
                  <TD>
                    {(m.figures ?? []).map((f) => (
                      <span key={f.asset} className="block text-[11px]">
                        <span className="num text-ink">margin {signed(f.margin, f.asset)}</span>{" "}
                        <span className="text-ink-faint">
                          (rev {signed(f.revenue, f.asset)} · cost {signed(f.cost, f.asset)})
                        </span>
                      </span>
                    ))}
                  </TD>
                  <TD>
                    {m.transit_residual?.map((r) => (
                      <span key={r.asset} className="num block text-[11px] text-warning">
                        {signed(r.amount, r.asset)}
                      </span>
                    )) ?? <span className="text-ink-faint">—</span>}
                  </TD>
                  <TD className="text-right">
                    <span className="flex justify-end gap-2">
                      {!ended(m) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPanel({ kind: "close", movement: m })}
                        >
                          Close
                        </Button>
                      )}
                      {m.status === "completed" && !m.parent_movement_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPanel({ kind: "open", parentId: m.id })}
                        >
                          Return
                        </Button>
                      )}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        {cursor && (
          <div className="flex justify-center border-t border-edge py-3">
            <Button size="sm" variant="outline" onClick={() => void more()}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

export function MovementsView() {
  return (
    <LedgerScope
      title="Movements"
      subtitle="Staged operations (remittances, payroll runs, refunds): status, transit and margin"
      demoNote="Sign in to see the movements of your ledgers."
    >
      {(ledger) => <MovementList ledgerId={ledger.id} />}
    </LedgerScope>
  );
}
