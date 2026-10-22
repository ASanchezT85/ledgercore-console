// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Provider exposure (6.3) and provider freeze (6.26) of one ledger: what each
 * provider holds, whether customer money is backed, whose money sits at which
 * provider, and the freeze / unfreeze of every account of a provider.
 */

import { useState } from "react";
import { LedgerScope } from "@/components/ledger-scope";
import {
  ApiDownBanner,
  ErrorBanner,
  LoadingCard,
  useLiveData,
} from "@/components/live";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoneyWithAsset } from "@/lib/format";
import {
  ApiError,
  freezeProvider,
  getExposureMatrix,
  getProviderExposure,
  unfreezeProvider,
  type ApiExposureMatrix,
  type ApiProviderExposure,
  type ExposureBreak,
  type FreezeMode,
} from "@/lib/live";

const money = (amount: string, asset: string, exponent: number) =>
  formatMoneyWithAsset(BigInt(amount), asset, exponent);

const BREAK_TEXT: Record<ExposureBreak["kind"], string> = {
  ledger_shortfall: "customer assets do not reach customer liabilities",
  negative_custody: "provider custody is below zero",
  provider_shortfall: "holders' traced money at the provider exceeds what it holds",
};

const inputClass =
  "h-9 w-full rounded-(--radius-control) border border-edge-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint";

function errorText(err: unknown): string {
  if (err instanceof ApiError)
    return `${err.code}${err.apiMessage ? ` — ${err.apiMessage}` : ""}`;
  return err instanceof Error ? err.message : "unknown_error";
}

type Action = { provider: string; kind: "freeze" | "unfreeze" };

function ProviderAction({
  ledgerId,
  action,
  onDone,
  onCancel,
}: {
  ledgerId: string;
  action: Action;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<FreezeMode>("all");
  const [reason, setReason] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const freezing = action.kind === "freeze";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        reason: reason.trim(),
        ...(caseRef.trim() ? { case_ref: caseRef.trim() } : {}),
      };
      const res = freezing
        ? await freezeProvider(ledgerId, action.provider, { ...body, mode })
        : await unfreezeProvider(ledgerId, action.provider, body);
      const frozen = res.data.filter((a) => a.status === "frozen").length;
      onDone(
        `${freezing ? "Froze" : "Unfroze"} ${action.provider}: ${res.data.length} accounts listed, ${frozen} frozen.`,
      );
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Card
      title={`${freezing ? "Freeze" : "Unfreeze"} provider ${action.provider}`}
      subtitle={
        freezing
          ? "Freezes every custody, receivable and payable account of the provider in one step. Holders' wallets stay active."
          : "Returns every frozen account of the provider to active. Claim accounts created by a by_provider freeze stay frozen."
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {freezing && (
          <label className="space-y-1 text-xs text-ink-faint">
            Mode
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as FreezeMode)}
              className={inputClass}
            >
              <option value="all">all (no debits, no credits)</option>
              <option value="debits">debits</option>
              <option value="credits">credits</option>
            </select>
          </label>
        )}
        <label className="space-y-1 text-xs text-ink-faint sm:col-span-2">
          Reason (required, goes to the audit log)
          <input
            className={inputClass}
            value={reason}
            maxLength={1024}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-ink-faint">
          Case reference (optional)
          <input
            className={inputClass}
            value={caseRef}
            maxLength={128}
            onChange={(e) => setCaseRef(e.target.value)}
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
          disabled={busy || reason.trim() === ""}
          onClick={() => void submit()}
        >
          {busy ? "Working…" : `Confirm ${freezing ? "freeze" : "unfreeze"}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function ExposureCard({
  data,
  onAction,
}: {
  data: ApiProviderExposure;
  onAction: (a: Action) => void;
}) {
  return (
    <Card
      title="Provider exposure"
      subtitle="What each provider holds per asset, and whether customer funds are backed"
      actions={
        <span className="flex items-center gap-2">
          <Badge tone="slate">{data.loss_allocation ?? "no loss rule"}</Badge>
          <Badge tone={data.backed ? "emerald" : "red"} dot>
            {data.backed ? "backed" : "not backed"}
          </Badge>
        </span>
      }
      flush
    >
      {data.breaks.length > 0 && (
        <ul className="space-y-1 border-b border-edge px-5 py-3">
          {data.breaks.map((b, i) => (
            <li key={i} className="text-xs text-danger">
              <strong>{b.kind}</strong>
              {b.provider ? ` · ${b.provider}` : ""} · missing{" "}
              <span className="num">{money(b.amount, b.asset, b.exponent)}</span>{" "}
              — {BREAK_TEXT[b.kind]}
            </li>
          ))}
        </ul>
      )}
      {data.data.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-faint">
          No account of this ledger names a provider (
          <code className="font-mono text-xs">metadata.provider</code> or a{" "}
          <code className="font-mono text-xs">provider</code> path segment).
        </p>
      ) : (
        <Table>
          <THead>
            <TH>Provider</TH>
            <TH>Asset</TH>
            <TH className="text-right">Customer custody</TH>
            <TH className="text-right">Claims</TH>
            <TH className="text-right">Own</TH>
            <TH className="text-right">Payable</TH>
            <TH>
              <span className="sr-only">Actions</span>
            </TH>
          </THead>
          <TBody>
            {data.data.map((r, i) => (
              <TR key={`${r.provider}/${r.asset}`}>
                <TD className="font-mono text-xs text-ink">{r.provider}</TD>
                <TD>{r.asset}</TD>
                <TD className="num text-right">{money(r.custody, r.asset, r.exponent)}</TD>
                <TD className="num text-right">{money(r.claims, r.asset, r.exponent)}</TD>
                <TD className="num text-right">{money(r.own, r.asset, r.exponent)}</TD>
                <TD className="num text-right">{money(r.payable, r.asset, r.exponent)}</TD>
                <TD className="text-right">
                  {/* one pair of buttons per provider, on its first row */}
                  {data.data.findIndex((x) => x.provider === r.provider) === i && (
                    <span className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAction({ provider: r.provider, kind: "freeze" })}
                      >
                        Freeze
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAction({ provider: r.provider, kind: "unfreeze" })}
                      >
                        Unfreeze
                      </Button>
                    </span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function MatrixCard({ ledgerId }: { ledgerId: string }) {
  const state = useLiveData<ApiExposureMatrix | "not_configured">(() =>
    getExposureMatrix(ledgerId).catch((err: unknown) => {
      if (err instanceof ApiError && err.code === "loss_allocation_not_configured")
        return "not_configured" as const;
      throw err;
    }),
  );
  return (
    <Card
      title="Exposure matrix"
      subtitle="Whose money sits at which provider, under the ledger's loss rule"
      flush
    >
      {state.status === "loading" && (
        <p className="px-5 py-6 text-sm text-ink-faint">Loading…</p>
      )}
      {state.status === "down" && <ApiDownBanner onRetry={state.reload} />}
      {state.status === "error" && (
        <ErrorBanner message={state.message} onRetry={state.reload} />
      )}
      {state.status === "live" && state.data === "not_configured" && (
        <p className="px-5 py-6 text-sm text-ink-muted">
          This ledger has no <code className="font-mono text-xs">loss_allocation</code>{" "}
          yet. Set it with{" "}
          <code className="font-mono text-xs">PUT /v1/ledgers/{"{id}"}/custody-policy</code>{" "}
          to see the matrix.
        </p>
      )}
      {state.status === "live" && state.data !== "not_configured" && (
        <Table>
          <THead>
            <TH>Holder</TH>
            <TH>Asset</TH>
            <TH className="text-right">Balance</TH>
            <TH>Shares by provider</TH>
            <TH className="text-right">Unplaced</TH>
          </THead>
          <TBody>
            {state.data.data.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-ink-faint">
                  No holder has a balance.
                </TD>
              </TR>
            )}
            {state.data.data.map((r) => (
              <TR key={`${r.holder}/${r.asset}`}>
                <TD className="font-mono text-xs text-ink">{r.holder || "(no holder)"}</TD>
                <TD>{r.asset}</TD>
                <TD className="num text-right">{money(r.balance, r.asset, r.exponent)}</TD>
                <TD>
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    {r.shares.map((s) => (
                      <span key={s.provider} className="text-xs">
                        <span className="font-mono">{s.provider}</span>{" "}
                        <span className="num text-ink">
                          {money(s.amount, r.asset, r.exponent)}
                        </span>
                      </span>
                    ))}
                  </span>
                </TD>
                <TD className="num text-right">{money(r.unplaced, r.asset, r.exponent)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function LedgerProviders({ ledgerId }: { ledgerId: string }) {
  const state = useLiveData(() => getProviderExposure(ledgerId));
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [matrixKey, setMatrixKey] = useState(0);

  if (state.status === "loading") return <LoadingCard orb="solving" />;
  if (state.status === "down") return <ApiDownBanner onRetry={state.reload} />;
  if (state.status === "error")
    return <ErrorBanner message={state.message} onRetry={state.reload} />;
  if (state.status !== "live") return null;

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
      <ExposureCard data={state.data} onAction={setAction} />
      {action && (
        <ProviderAction
          ledgerId={ledgerId}
          action={action}
          onCancel={() => setAction(null)}
          onDone={(m) => {
            setNotice(m);
            setAction(null);
            setMatrixKey((k) => k + 1);
            state.reload();
          }}
        />
      )}
      <MatrixCard key={matrixKey} ledgerId={ledgerId} />
    </>
  );
}

export function ProvidersView() {
  return (
    <LedgerScope
      title="Providers"
      subtitle="Provider exposure, customer-fund backing and provider freeze per ledger"
      demoNote="Sign in to see provider exposure for your ledgers."
    >
      {(ledger) => <LedgerProviders ledgerId={ledger.id} />}
    </LedgerScope>
  );
}
