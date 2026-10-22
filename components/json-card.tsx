// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * A request body typed as JSON, for objects whose contract is deeply nested
 * (posting rules, posting groups): the person edits the body of the call, the
 * console validates that it is a JSON object, asks for confirmation and sends
 * it as is. The API stays the only judge of what is valid.
 */

import { useState } from "react";
import { ErrorLine } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiErrorText } from "@/lib/live";

export function JsonCard({
  title,
  subtitle,
  template,
  submitLabel,
  confirmText,
  onSubmit,
  onDone,
}: {
  title: string;
  subtitle: string;
  template: string;
  submitLabel: string;
  confirmText: string;
  onSubmit: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onDone?: (result: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(template);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  let parsed: Record<string, unknown> | null = null;
  let parseError: string | null = null;
  try {
    const v: unknown = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) parsed = v as Record<string, unknown>;
    else parseError = "The body must be a JSON object.";
  } catch (e) {
    parseError = e instanceof Error ? e.message : "Invalid JSON.";
  }

  async function send() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await onSubmit(parsed);
      setResult(r);
      setConfirming(false);
      onDone?.(r);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={title} subtitle={subtitle}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={14}
        className="w-full rounded-(--radius-control) border border-edge-strong bg-code p-3 font-mono text-xs text-ink"
      />
      {parseError && <p className="mt-1 text-xs text-danger">{parseError}</p>}
      <ErrorLine message={error} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!confirming ? (
          <Button size="sm" disabled={!parsed || busy} onClick={() => setConfirming(true)}>
            {submitLabel}…
          </Button>
        ) : (
          <>
            <span className="text-xs text-ink">{confirmText}</span>
            <Button size="sm" disabled={busy} onClick={() => void send()}>
              {busy ? "Sending…" : "Confirm"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Back
            </Button>
          </>
        )}
      </div>
      {result && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-edge bg-code p-3 font-mono text-[11px] text-ink-muted">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </Card>
  );
}
