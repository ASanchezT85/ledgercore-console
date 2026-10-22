// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CodeInput } from "@/components/code-input";
import { Button } from "@/components/ui/button";
import { DICTIONARIES, detectLang } from "@/lib/i18n";
import {
  CodeError,
  LockedError,
  PasskeyCancelled,
  passkeysSupported,
  setStepUpHandler,
  stepUp,
  twoFactorStatus,
} from "@/lib/session";

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
  const [hasPasskey, setHasPasskey] = useState(false);
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
          setHasPasskey(false);
          setOpen(true);
          if (passkeysSupported()) {
            twoFactorStatus()
              .then((st) => setHasPasskey(st.passkeys > 0))
              .catch(() => undefined);
          }
        }),
    );
    return () => setStepUpHandler(null);
  }, []);

  function close(ok: boolean) {
    setOpen(false);
    resolve.current?.(ok);
    resolve.current = null;
  }

  async function run(input: { code: string } | { passkey: true }) {
    setBusy(true);
    setError(null);
    try {
      await stepUp(input);
      close(true);
    } catch (err) {
      setCode("");
      if (err instanceof PasskeyCancelled) setError(null);
      else if (err instanceof CodeError) setError("passkey" in input ? t.passkeyFailed : t.invalid);
      else setError(err instanceof LockedError ? t.locked : t.failed);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run({ code });
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
        {hasPasskey && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void run({ passkey: true })}>
            {t.usePasskey}
          </Button>
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
