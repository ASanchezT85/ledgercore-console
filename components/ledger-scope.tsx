// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Page chrome shared by the screens that work on one ledger at a time: title,
 * demo/loading/error states and the ledger selector. `children` is rendered
 * with the selected ledger and remounts when it changes.
 */

import { useState, type ReactNode } from "react";
import { DemoBadge } from "@/components/demo-badge";
import {
  ApiDownBanner,
  EmptyState,
  ErrorBanner,
  LoadingCard,
  useLiveData,
} from "@/components/live";
import { Card } from "@/components/ui/card";
import { listLedgers, type ApiLedger } from "@/lib/live";

export function LedgerScope({
  title,
  subtitle,
  demoNote,
  children,
}: {
  title: string;
  subtitle: string;
  demoNote: string;
  children: (ledger: ApiLedger) => ReactNode;
}) {
  const state = useLiveData(async () => (await listLedgers()).data);
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">{title}</h1>
          <p className="mt-0.5 text-sm text-ink-faint">{subtitle}</p>
        </div>
        <DemoBadge demo={state.status === "demo"} />
      </div>

      {state.status === "loading" && <LoadingCard orb="solving" />}
      {state.status === "demo" && (
        <Card>
          <p className="py-6 text-center text-sm text-ink-muted">{demoNote}</p>
        </Card>
      )}
      {state.status === "down" && <ApiDownBanner onRetry={state.reload} />}
      {state.status === "error" && (
        <ErrorBanner message={state.message} onRetry={state.reload} />
      )}
      {state.status === "live" &&
        (state.data.length === 0 ? (
          <EmptyState
            title="No ledgers in this tenant yet"
            body="Create a ledger first (Ledgers page) and come back."
          />
        ) : (
          <>
            <label className="flex items-center gap-3 text-xs text-ink-faint">
              Ledger
              <select
                value={picked ?? state.data[0]!.id}
                onChange={(e) => setPicked(e.target.value)}
                className="h-9 rounded-(--radius-control) border border-edge-strong bg-surface px-3 text-sm text-ink"
              >
                {state.data.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.environment})
                  </option>
                ))}
              </select>
            </label>
            {(() => {
              const ledger =
                state.data.find((l) => l.id === picked) ?? state.data[0]!;
              return <div key={ledger.id} className="space-y-6">{children(ledger)}</div>;
            })()}
          </>
        ))}
    </div>
  );
}
