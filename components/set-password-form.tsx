// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import {
  AuthCard,
  AuthPage,
  ErrorNote,
  Field,
  inputClass,
  SubmitButton,
} from "@/components/auth-shell";
import { useLang } from "@/components/language";
import { IdentityError, identityFetch } from "@/lib/session";
import { useQueryParam } from "@/lib/use-query-param";

/**
 * "Choose a password with the token from the email": shared by accepting an
 * invitation and resetting a forgotten password. The token comes in the URL
 * (?token=...) and goes straight to the identity API.
 */
function SetPassword({ kind }: { kind: "invite" | "reset" }) {
  const { t } = useLang();
  const a = t.auth;
  const c = kind === "invite" ? a.invite : a.reset;
  const token = useQueryParam("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError(a.password.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await identityFetch(
        "POST",
        kind === "invite" ? "auth/invitations/accept" : "auth/password/reset",
        { token, password },
      );
      setDone(true);
    } catch (err) {
      if (err instanceof IdentityError && err.status === 404) setError(a.invalidLink);
      // 400: the identity API explains the password policy in English; show it.
      else if (err instanceof IdentityError && err.status === 400) setError(err.message);
      else if (err instanceof Error && err.message === "network") setError(a.errNetwork);
      else setError(a.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (token === undefined) return null; // not read yet

  if (!token) {
    return (
      <AuthCard title={c.title}>
        <ErrorNote>{a.noToken}</ErrorNote>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title={c.doneTitle}>
        <p className="mb-4 text-xs text-ink-muted">{c.doneBody}</p>
        <Link
          href="/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-(--radius-control) bg-accent-deep text-sm font-semibold text-[#03150e] hover:bg-accent"
        >
          {a.goLogin}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={c.title}>
      <form onSubmit={onSubmit} className="space-y-3">
        {kind === "invite" && <p className="text-xs text-ink-muted">{a.invite.intro}</p>}
        <Field label={a.password.newLabel} hint={a.password.hint}>
          <KeyRound size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            type="password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="new-password"
            autoFocus
          />
        </Field>
        <Field label={a.password.confirmLabel}>
          <KeyRound size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
            autoComplete="new-password"
          />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <SubmitButton
          busy={busy}
          disabled={!password || !confirm}
          label={c.submit}
          busyLabel={c.busy}
        />
      </form>
    </AuthCard>
  );
}

export function SetPasswordPage({ kind }: { kind: "invite" | "reset" }) {
  return (
    <AuthPage>
      <SetPassword kind={kind} />
    </AuthPage>
  );
}
