// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useState } from "react";
import { ErrorLine } from "@/components/form";
import { Button } from "@/components/ui/button";
import { apiErrorText, discardTransaction, postTransaction } from "@/lib/live";

/** Post or discard a draft transaction; each asks to be confirmed first. */
export function DraftActions({
  id,
  onChanged,
}: {
  id: string;
  onChanged: (message: string) => void;
}) {
  const [pending, setPending] = useState<"post" | "discard" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const t = await (pending === "post" ? postTransaction(id) : discardTransaction(id));
      onChanged(`Transaction ${t.id} ${t.status}.`);
    } catch (e) {
      setError(apiErrorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-edge bg-surface-raised px-4 py-3">
      <p className="text-[10px] font-semibold tracking-wider text-ink-faint uppercase">Draft</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pending === null ? (
          <>
            <Button size="sm" onClick={() => setPending("post")}>Post…</Button>
            <Button size="sm" variant="outline" onClick={() => setPending("discard")}>Discard…</Button>
          </>
        ) : (
          <>
            <span className="text-xs text-ink">
              {pending === "post" ? "Post this draft? It cannot be edited afterwards." : "Discard this draft? This is final."}
            </span>
            <Button size="sm" disabled={busy} onClick={() => void run()}>{busy ? "Working…" : "Confirm"}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending(null)}>Back</Button>
          </>
        )}
      </div>
      <ErrorLine message={error} />
    </div>
  );
}
