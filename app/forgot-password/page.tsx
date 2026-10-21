// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import {
  AuthCard,
  AuthPage,
  ErrorNote,
  Field,
  inputClass,
  SubmitButton,
} from "@/components/auth-shell";
import { useLang } from "@/components/language";
import { identityFetch } from "@/lib/session";

function ForgotForm() {
  const { t } = useLang();
  const c = t.auth.forgot;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await identityFetch("POST", "auth/password/forgot", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error && err.message === "network" ? t.auth.errNetwork : t.auth.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={sent ? c.sentTitle : c.title}>
      {sent ? (
        <p className="text-xs text-ink-muted">{c.sentBody}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-xs text-ink-muted">{c.intro}</p>
          <Field label={t.login.emailLabel}>
            <Mail size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.login.emailPlaceholder}
              className={inputClass}
              autoComplete="username"
              autoFocus
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton busy={busy} disabled={!email.trim()} label={c.submit} busyLabel={c.busy} />
        </form>
      )}
      <p className="mt-4 text-center text-[11px]">
        <Link href="/login" className="text-accent hover:underline">
          {c.back}
        </Link>
      </p>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthPage>
      <ForgotForm />
    </AuthPage>
  );
}
