// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, KeyRound, Mail } from "lucide-react";
import {
  AuthCard,
  AuthPage,
  ErrorNote,
  Field,
  InfoNote,
  inputClass,
  SubmitButton,
} from "@/components/auth-shell";
import { useLang } from "@/components/language";
import { AuthError, LockedError, login } from "@/lib/session";
import { useQueryParam } from "@/lib/use-query-param";

function LoginForm() {
  const router = useRouter();
  const { t } = useLang();
  const c = t.login;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = useQueryParam("reason") === "expired";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const state = await login(email, password);
      // Not active yet: the second factor is mandatory (ADR-022). The 2FA screen
      // asks the server whether to enrol or to verify.
      router.push(state === "active" ? "/dashboard" : "/login/2fa");
    } catch (err) {
      if (err instanceof AuthError) {
        setError(c.errInvalid);
      } else if (err instanceof LockedError) {
        setError(c.errLocked.replace("{seconds}", String(err.retryAfter)));
      } else if (err instanceof Error && err.message === "network") {
        setError(c.errNetwork);
      } else {
        setError(c.errGeneric);
      }
      setBusy(false);
    }
  }

  return (
    <AuthCard title={c.title}>
      <form onSubmit={onSubmit} className="space-y-3">
        {expired && !error && <InfoNote>{c.expired}</InfoNote>}

        <Field label={c.emailLabel}>
          <Mail size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={c.emailPlaceholder}
            className={inputClass}
            autoComplete="username"
            autoFocus
          />
        </Field>

        <Field label={c.passwordLabel}>
          <KeyRound size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
          />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <SubmitButton
          busy={busy}
          disabled={!email.trim() || !password}
          label={c.submit}
          busyLabel={c.submitBusy}
        />
      </form>

      <p className="mt-3 text-center text-[11px] text-ink-faint">
        <Link href="/forgot-password" className="text-accent hover:underline">
          {c.forgot}
        </Link>
      </p>
      <p className="mt-1 text-center text-[11px] text-ink-faint">
        {c.signupPre}
        <Link href="/signup" className="text-accent hover:underline">
          {c.signupLink}
        </Link>
        .
      </p>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-edge" aria-hidden="true" />
        <span className="text-[10px] tracking-widest text-ink-faint uppercase">{c.or}</span>
        <span className="h-px flex-1 bg-edge" aria-hidden="true" />
      </div>

      <Link
        href="/dashboard"
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-(--radius-control) border border-edge-strong text-sm font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent"
      >
        <FlaskConical size={14} aria-hidden="true" />
        {c.demoMode}
      </Link>
    </AuthCard>
  );
}

export function LoginView() {
  return (
    <AuthPage>
      <LoginForm />
    </AuthPage>
  );
}
