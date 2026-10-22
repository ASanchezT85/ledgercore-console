// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Accounting periods of a ledger: create the next one and close periods
 * (open -> soft closed -> hard closed). Closing only moves forward; a hard
 * close is corrected with an adjustment dated in an open period.
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { LedgerScope } from "@/components/ledger-scope";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  apiErrorText,
  createPeriod,
  listPeriods,
  transitionPeriod,
  type ApiPeriod,
  type PeriodStatus,
} from "@/lib/live";

const TONE: Record<PeriodStatus, BadgeTone> = {
  open: "emerald",
  soft_closed: "amber",
  hard_closed: "red",
};

const NEXT: Record<PeriodStatus, PeriodStatus[]> = {
  open: ["soft_closed", "hard_closed"],
  soft_closed: ["hard_closed"],
  hard_closed: [],
};

function PeriodsBody({ ledgerId }: { ledgerId: string }) {
  const [periods, setPeriods] = useState<ApiPeriod[] | null>(null);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pending, setPending] = useState<{ id: string; to: PeriodStatus } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPeriods(ledgerId).then(
      (p) => setPeriods(p.data),
      (e) => setError(apiErrorText(e)),
    );
  }, [ledgerId, version]);

  // The new period starts where the latest one ends (the API requires it).
  const latestEnd = periods?.reduce<string | null>(
    (m, p) => (m === null || p.ends_at > m ? p.ends_at : m),
    null,
  );

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNotice(message);
      setPending(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Notice message={notice} />
      <Card title="New period" subtitle={latestEnd ? `Must start at ${formatDateTime(latestEnd)}, where the last one ends.` : "The first period can start at any instant."}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <input className={inputClass} value={name} maxLength={255} placeholder="2026-11" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Starts (inclusive)">
            <input type="datetime-local" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Ends (exclusive)">
            <input type="datetime-local" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <ErrorLine message={error} />
        <div className="mt-4 flex gap-2">
          {latestEnd && (
            <Button size="sm" variant="ghost" onClick={() => setStart(new Date(latestEnd).toISOString().slice(0, 16))}>
              Start after the last period
            </Button>
          )}
          <Button
            size="sm"
            disabled={busy || !name.trim() || !start || !end}
            onClick={() =>
              void run(
                () =>
                  createPeriod({
                    ledger_id: ledgerId,
                    name: name.trim(),
                    starts_at: new Date(start).toISOString(),
                    ends_at: new Date(end).toISOString(),
                  }),
                `Created period ${name.trim()}.`,
              )
            }
          >
            Create period
          </Button>
        </div>
      </Card>

      <Card title="Periods" subtitle="Newest first" flush>
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Starts</TH>
            <TH>Ends</TH>
            <TH>Status</TH>
            <TH>
              <span className="sr-only">Actions</span>
            </TH>
          </THead>
          <TBody>
            {periods?.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-ink-faint">
                  No periods yet.
                </TD>
              </TR>
            )}
            {periods?.map((p) => (
              <TR key={p.id}>
                <TD className="font-mono text-xs text-ink">{p.name}</TD>
                <TD className="text-xs">{formatDateTime(p.starts_at)}</TD>
                <TD className="text-xs">{formatDateTime(p.ends_at)}</TD>
                <TD>
                  <Badge tone={TONE[p.status]} dot>
                    {p.status.replace("_", " ")}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {pending?.id === p.id ? (
                      <>
                        <span className="text-xs text-ink">
                          {pending.to === "hard_closed"
                            ? "Hard close cannot be reopened. Confirm?"
                            : "Soft close: only adjustments of this period. Confirm?"}
                        </span>
                        <Button size="sm" disabled={busy} onClick={() => void run(() => transitionPeriod(p.id, pending.to), `Period ${p.name} is now ${pending.to.replace("_", " ")}.`)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                          Back
                        </Button>
                      </>
                    ) : (
                      NEXT[p.status].map((to) => (
                        <Button key={to} size="sm" variant="outline" onClick={() => setPending({ id: p.id, to })}>
                          {to === "soft_closed" ? "Soft close…" : "Hard close…"}
                        </Button>
                      ))
                    )}
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

export function PeriodsView() {
  return (
    <LedgerScope
      title="Periods"
      subtitle="Accounting periods and their closing"
      demoNote="Sign in to manage the periods of your ledgers."
    >
      {(ledger) => <PeriodsBody ledgerId={ledger.id} />}
    </LedgerScope>
  );
}
