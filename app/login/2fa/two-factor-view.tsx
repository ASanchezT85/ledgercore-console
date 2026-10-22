// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  AuthCard,
  AuthPage,
  ErrorNote,
  Field,
  inputClass,
  SubmitButton,
} from "@/components/auth-shell";
import { useLang } from "@/components/language";
import { QrCode } from "@/components/qr-code";
import { RecoveryCodes } from "@/components/recovery-codes";
import {
  AuthError,
  CodeError,
  confirmEnrollment,
  type Enrollment,
  LockedError,
  logout,
  startEnrollment,
  twoFactorStatus,
  verifySecondFactor,
} from "@/lib/session";

type Phase =
  | { kind: "loading" }
  | { kind: "enroll"; enrollment: Enrollment }
  | { kind: "verify" }
  | { kind: "codes"; codes: string[] };

/**
 * The screen between the password and the console (ADR-022). Which form it
 * shows comes from the server, so a reload lands on the right one: a user with
 * no authenticator enrols (QR, then the one-time recovery codes), a user with
 * one types a code. Nothing else works while the session is password_verified.
 */
function TwoFactor() {
  const router = useRouter();
  const { t } = useLang();
  const c = t.twoFactor;
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (err: unknown, recoveryCode = false) => {
      if (err instanceof AuthError) {
        router.replace("/login?reason=expired");
        return;
      }
      if (err instanceof CodeError) setError(recoveryCode ? c.errInvalidRecovery : c.errInvalid);
      else if (err instanceof LockedError) setError(c.errLocked.replace("{seconds}", String(err.retryAfter)));
      else if (err instanceof Error && err.message === "network") setError(c.errNetwork);
      else setError(c.errGeneric);
    },
    [router, c],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const st = await twoFactorStatus();
        if (cancelled) return;
        if (st.state === "active") {
          router.replace("/dashboard");
        } else if (st.enabled) {
          setPhase({ kind: "verify" });
        } else {
          const enrollment = await startEnrollment();
          if (!cancelled) setPhase({ kind: "enroll", enrollment });
        }
      } catch (err) {
        if (!cancelled) {
          setPhase({ kind: "verify" });
          fail(err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, fail]);

  async function onEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const codes = await confirmEnrollment(code.trim());
      setCode("");
      setPhase({ kind: "codes", codes });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await verifySecondFactor(recovery ? { recoveryCode: code.trim() } : { code: code.trim() });
      router.push("/dashboard");
    } catch (err) {
      fail(err, recovery);
      setBusy(false);
    }
  }

  async function cancel() {
    await logout();
    router.replace("/login");
  }

  const cancelLink = (
    <p className="mt-4 text-center text-[11px] text-ink-faint">
      <button type="button" onClick={() => void cancel()} className="text-accent hover:underline">
        {c.signOut}
      </button>
    </p>
  );

  if (phase.kind === "loading") {
    return (
      <AuthCard title={c.title}>
        <p role="status" className="text-xs text-ink-muted">
          {c.loading}
        </p>
      </AuthCard>
    );
  }

  if (phase.kind === "codes") {
    return (
      <AuthCard title={c.codes.title}>
        <p className="mb-3 text-xs text-ink-muted">{c.codes.intro}</p>
        <RecoveryCodes codes={phase.codes} copyLabel={c.codes.copy} copiedLabel={c.codes.copied} />
        <label className="mt-4 flex items-start gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-0.5"
          />
          {c.codes.saved}
        </label>
        <button
          type="button"
          disabled={!saved}
          onClick={() => router.push("/dashboard")}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-(--radius-control) bg-accent-deep text-sm font-semibold text-[#03150e] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {c.codes.continue}
        </button>
      </AuthCard>
    );
  }

  if (phase.kind === "enroll") {
    const e = c.enroll;
    return (
      <AuthCard title={e.title}>
        <p className="mb-4 text-xs text-ink-muted">{e.intro}</p>
        <div className="mb-4 flex justify-center">
          <QrCode text={phase.enrollment.otpauth_uri} alt={e.qrAlt} />
        </div>
        <p className="text-[11px] text-ink-muted">{e.manualTitle}</p>
        <p className="mt-1 rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-center font-mono text-sm tracking-wider break-all text-ink select-all">
          {phase.enrollment.secret}
        </p>
        <p className="mt-1 mb-4 text-[11px] text-ink-faint">{e.manualHint}</p>
        <form onSubmit={onEnroll} className="space-y-3">
          <CodeField label={e.codeLabel} value={code} onChange={setCode} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton busy={busy} disabled={code.replace(/\D/g, "").length < 6} label={e.submit} busyLabel={e.busy} />
        </form>
        {cancelLink}
      </AuthCard>
    );
  }

  const v = c.verify;
  return (
    <AuthCard title={v.title}>
      <form onSubmit={onVerify} className="space-y-3">
        <p className="text-xs text-ink-muted">{recovery ? v.recoveryIntro : v.intro}</p>
        {recovery ? (
          <Field label={v.recoveryLabel}>
            <ShieldCheck size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={v.recoveryPlaceholder}
              className={`${inputClass} font-mono uppercase`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              autoFocus
            />
          </Field>
        ) : (
          <CodeField label={v.codeLabel} value={code} onChange={setCode} />
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <SubmitButton
          busy={busy}
          disabled={recovery ? code.replace(/[\s-]/g, "").length < 10 : code.replace(/\D/g, "").length < 6}
          label={v.submit}
          busyLabel={v.busy}
        />
      </form>
      <p className="mt-3 text-center text-[11px]">
        <button
          type="button"
          onClick={() => {
            setRecovery(!recovery);
            setCode("");
            setError(null);
          }}
          className="text-accent hover:underline"
        >
          {recovery ? v.useApp : v.useRecovery}
        </button>
      </p>
      {cancelLink}
    </AuthCard>
  );
}

function CodeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <ShieldCheck size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
      <input
        type="text"
        required
        inputMode="numeric"
        pattern="[0-9 ]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ""))}
        placeholder="123456"
        className={`${inputClass} font-mono tracking-widest`}
        autoComplete="one-time-code"
        maxLength={7}
        autoFocus
      />
    </Field>
  );
}

export function TwoFactorView() {
  return (
    <AuthPage>
      <TwoFactor />
    </AuthPage>
  );
}
