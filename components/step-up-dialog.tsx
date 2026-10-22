// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CodeInput } from "@/components/code-input";
import { Button } from "@/components/ui/button";
import { DICTIONARIES, detectLang } from "@/lib/i18n";
import { CodeError, LockedError, setStepUpHandler, stepUp } from "@/lib/session";

/**
 * Asks for a fresh TOTP code when ledger-core answers step_up_required
 * (ADR-030). apiFetch waits on it and retries the refused write once the
 * code checked out; cancelling surfaces the original error.
 */
export function StepUpDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolve = useRef<((ok: boolean) => void) | null>(null);
  const t = DICTIONARIES[detectLang()].stepUp;

  useEffect(() => {
    setStepUpHandler(
      () =>
        new Promise<boolean>((r) => {
          resolve.current?.(false); // a second refusal while open replaces the first
          resolve.current = r;
          setCode("");
          setError(null);
          setOpen(true);
        }),
    );
    return () => setStepUpHandler(null);
  }, []);

  function close(ok: boolean) {
    setOpen(false);
    resolve.current?.(ok);
    resolve.current = null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await stepUp(code);
      close(true);
    } catch (err) {
      setCode("");
      setError(err instanceof CodeError ? t.invalid : err instanceof LockedError ? t.locked : t.failed);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="step-up-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label={t.cancel}
        onClick={() => close(false)}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm space-y-4 rounded-lg border border-edge bg-surface p-6 shadow-2xl"
      >
        <h2 id="step-up-title" className="text-base font-semibold text-ink">
          {t.title}
        </h2>
        <p className="text-sm text-ink-muted">{t.intro}</p>
        <CodeInput label={t.codeLabel} value={code} onChange={setCode} autoFocus />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {t.confirm}
          </Button>
        </div>
      </form>
    </div>
  );
}
