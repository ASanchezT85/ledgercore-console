// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthCard, AuthPage, ErrorNote, Field, InfoNote, inputClass, SubmitButton } from "@/components/auth-shell";
import { CodeInput } from "@/components/code-input";
import { useLang } from "@/components/language";
import { forgetPendingEmail, pendingEmail, resendEmailCode, verifyEmail } from "@/lib/onboarding";
import { IdentityError, LockedError } from "@/lib/session";
import { useCountdown } from "@/lib/use-countdown";

const RESEND_SECONDS = 60;

function VerifyEmail() {
  const { t } = useLang();
  const c = t.verifyEmail;
  const [email, setEmail] = useState("");
  const [remembered, setRemembered] = useState(false); // the address came from the signup
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(false);
  const [left, startCountdown] = useCountdown();

  useEffect(() => {
    const known = pendingEmail();
    setEmail(known);
    setRemembered(known !== "");
    startCountdown(RESEND_SECONDS); // a code was just mailed by the signup
  }, [startCountdown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim() || code.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(email, code);
      forgetPendingEmail();
      setDone(true);
    } catch (err) {
      if (err instanceof IdentityError && err.status === 400) setError(c.errCode);
      else if (err instanceof Error && err.message === "network") setError(c.errNetwork);
      else setError(c.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (left > 0 || !email.trim()) return;
    setError(null);
    setResent(false);
    startCountdown(RESEND_SECONDS);
    try {
      await resendEmailCode(email);
      setResent(true);
    } catch (err) {
      if (err instanceof LockedError) startCountdown(err.retryAfter);
      else setError(err instanceof Error && err.message === "network" ? c.errNetwork : c.errGeneric);
    }
  }

  if (done) {
    return (
      <AuthCard title={c.doneTitle}>
        <p className="mb-5 text-xs text-ink-muted">{c.doneBody}</p>
        <Link
          href="/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-(--radius-control) bg-accent-deep text-sm font-semibold text-on-accent transition-colors hover:bg-accent"
        >
          {c.goLogin}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={c.title}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-ink-muted">
          {remembered ? c.intro.replace("{email}", email) : c.introNoEmail}
        </p>
        {!remembered && (
          <Field label={c.emailLabel}>
            <Mail size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="username" />
          </Field>
        )}
        <CodeInput label={c.codeLabel} value={code} onChange={setCode} autoFocus />
        {error && <ErrorNote>{error}</ErrorNote>}
        {resent && !error && <InfoNote>{c.resent}</InfoNote>}
        <SubmitButton busy={busy} disabled={!email.trim() || code.length < 6} label={c.submit} busyLabel={c.busy} />
      </form>
      <p className="mt-4 text-center text-[11px] text-ink-faint">
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={left > 0 || !email.trim()}
          className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
        >
          {left > 0 ? c.resendIn.replace("{seconds}", String(left)) : c.resend}
        </button>
      </p>
    </AuthCard>
  );
}

export function VerifyEmailView() {
  return (
    <AuthPage>
      <VerifyEmail />
    </AuthPage>
  );
}
