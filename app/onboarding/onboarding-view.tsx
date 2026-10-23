// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { ErrorNote, InfoNote, SubmitButton } from "@/components/auth-shell";
import { CodeInput } from "@/components/code-input";
import { LanguageProvider, useLang } from "@/components/language";
import { SessionHeader } from "@/components/session-header";
import {
  getOnboarding,
  PRE_SANDBOX,
  requestReview,
  resendEmailCode,
  sendPhoneCode,
  verifyEmail,
  verifyPhone,
  type Onboarding,
} from "@/lib/onboarding";
import { getSessionInfo, IdentityError, LockedError, logout, type SessionInfo } from "@/lib/session";
import { useCountdown } from "@/lib/use-countdown";

const RESEND_SECONDS = 60;
const TOTAL_STEPS = 4;

type Load = { kind: "loading" } | { kind: "ready"; info: SessionInfo; ob: Onboarding };

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-(--radius-card) border border-edge bg-surface/80 p-6 shadow-raised backdrop-blur-md">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

const linkButton =
  "inline-flex h-10 items-center justify-center rounded-(--radius-control) bg-accent-deep px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent";
const ghostButton =
  "inline-flex h-10 items-center justify-center rounded-(--radius-control) border border-edge-strong px-4 text-sm font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent";

/** Progress the person can see at a glance: four steps, the state of each, and "step n of 4". */
function Stepper({ ob }: { ob: Onboarding }) {
  const { t } = useLang();
  const c = t.onboarding;
  const done = [
    ob.steps.email_verified,
    ob.steps.two_factor_enrolled,
    ob.steps.phone_verified,
    ob.status === "approved",
  ];
  const finished = done.filter(Boolean).length;
  const current = done.indexOf(false); // -1 once everything is done
  const labels = [c.stepEmail, c.stepTwoFactor, c.stepPhone, c.stepReview];
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between text-xs text-ink-muted">
        <span>{c.progress.replace("{n}", String(Math.min(finished + 1, TOTAL_STEPS))).replace("{total}", String(TOTAL_STEPS))}</span>
        <span className="font-mono">{Math.round((finished / TOTAL_STEPS) * 100)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={c.stepsAria}
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={finished}
        className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(finished / TOTAL_STEPS) * 100}%` }} />
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {labels.map((label, i) => {
          const state = done[i] ? "done" : i === current ? "current" : "pending";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  state === "done"
                    ? "border-accent bg-accent text-on-accent"
                    : state === "current"
                      ? "border-accent text-accent"
                      : "border-edge-strong text-ink-faint"
                }`}
              >
                {state === "done" ? <Check size={14} aria-hidden="true" /> : i + 1}
              </span>
              <span className={`text-[11px] ${state === "pending" ? "text-ink-faint" : "text-ink"}`}>{label}</span>
              <span className="sr-only">{state === "done" ? c.done : state === "current" ? c.current : c.pending}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EmailStep({ email, onDone }: { email: string; onDone: () => void }) {
  const { t } = useLang();
  const c = t.onboarding;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [left, start] = useCountdown();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || code.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(email, code);
      onDone();
    } catch (err) {
      setError(err instanceof IdentityError && err.status === 400 ? c.errCode : err instanceof Error && err.message === "network" ? c.errNetwork : c.errGeneric);
      setBusy(false);
    }
  }
  async function resend() {
    if (left > 0) return;
    setError(null);
    start(RESEND_SECONDS);
    try {
      await resendEmailCode(email);
      setResent(true);
    } catch (err) {
      if (err instanceof LockedError) start(err.retryAfter);
      else setError(c.errGeneric);
    }
  }
  return (
    <Card title={c.email.title}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-ink-muted">{c.email.body.replace("{email}", email)}</p>
        <CodeInput label={c.code.codeLabel} value={code} onChange={setCode} autoFocus />
        {error && <ErrorNote>{error}</ErrorNote>}
        {resent && !error && <InfoNote>{c.code.resent}</InfoNote>}
        <SubmitButton busy={busy} disabled={code.length < 6} label={c.code.submit} busyLabel={c.code.busy} />
      </form>
      <p className="mt-3 text-center text-[11px]">
        <button type="button" onClick={() => void resend()} disabled={left > 0} className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline">
          {left > 0 ? c.code.resendIn.replace("{seconds}", String(left)) : c.code.resend}
        </button>
      </p>
    </Card>
  );
}

function PhoneStep({ phone, onDone }: { phone: string; onDone: () => void }) {
  const { t } = useLang();
  const c = t.onboarding;
  const p = c.phone;
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, start] = useCountdown();

  const fail = (err: unknown) => {
    if (err instanceof LockedError) {
      start(err.retryAfter);
      setError(c.errThrottle.replace("{seconds}", String(err.retryAfter)));
    } else if (err instanceof IdentityError && err.status === 400) setError(c.errCode);
    else if (err instanceof Error && err.message === "network") setError(c.errNetwork);
    else setError(c.errGeneric);
  };

  async function send() {
    if (sending || left > 0) return;
    setSending(true);
    setError(null);
    try {
      await sendPhoneCode();
      setSent(true);
      start(RESEND_SECONDS);
    } catch (err) {
      fail(err);
    } finally {
      setSending(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || code.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhone(code);
      onDone();
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  }
  return (
    <Card title={p.title}>
      <p className="mb-3 text-xs text-ink-muted">{(sent ? p.bodyAfter : p.bodyBefore).replace("{phone}", phone)}</p>
      {sent && (
        <form onSubmit={submit} className="mb-3 space-y-3">
          <CodeInput label={p.codeLabel} value={code} onChange={setCode} autoFocus />
          <SubmitButton busy={busy} disabled={code.length < 6} label={p.submit} busyLabel={p.busy} />
        </form>
      )}
      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
      {!sent ? (
        <button type="button" onClick={() => void send()} disabled={sending} className={`${linkButton} w-full disabled:opacity-50`}>
          {sending ? p.sending : p.send}
        </button>
      ) : (
        <p className="text-center text-[11px]">
          <button type="button" onClick={() => void send()} disabled={left > 0 || sending} className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline">
            {left > 0 ? p.resendIn.replace("{seconds}", String(left)) : p.resend}
          </button>
        </p>
      )}
    </Card>
  );
}

function ReviewRequest({ title, body, label, onDone, extra, icon }: { title: string; body: React.ReactNode; label: string; onDone: () => void; extra?: React.ReactNode; icon?: React.ReactNode }) {
  const { t } = useLang();
  const c = t.onboarding;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function ask() {
    setBusy(true);
    setError(null);
    try {
      await requestReview();
      onDone();
    } catch (err) {
      setError(err instanceof Error && err.message === "network" ? c.errNetwork : c.errGeneric);
      setBusy(false);
    }
  }
  return (
    <Card title={title} icon={icon ?? <CheckCircle2 size={16} className="text-accent" aria-hidden="true" />}>
      <div className="mb-4 text-xs text-ink-muted">{body}</div>
      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void ask()} disabled={busy} className={`${linkButton} disabled:opacity-50`}>
          {busy ? c.sandbox.busy : label}
        </button>
        {extra}
      </div>
    </Card>
  );
}

function ProfileSummary({ ob }: { ob: Onboarding }) {
  const { t } = useLang();
  if (!ob.profile) return null;
  const p = ob.profile;
  const rows = [p.legal_name, p.tax_id, `${p.city}, ${p.region}, ${p.country}`, p.address_line, p.postal_code, p.phone];
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">{t.onboarding.profileTitle}</h2>
      <ul className="space-y-0.5 text-xs text-ink-muted">
        {rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

function Wizard() {
  const router = useRouter();
  const { t, lang } = useLang();
  const c = t.onboarding;
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const info = await getSessionInfo(true);
      if (!info) {
        router.replace("/login?reason=expired");
        return;
      }
      const ob = await getOnboarding();
      setLoad({ kind: "ready", info, ob });
    } catch (err) {
      if (err instanceof IdentityError && (err.status === 401 || err.status === 403)) router.replace("/login?reason=expired");
      else setError(err instanceof Error && err.message === "network" ? c.errNetwork : c.errGeneric);
    }
  }, [router, c.errNetwork, c.errGeneric]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  if (load.kind === "loading") {
    return error ? <ErrorNote>{error}</ErrorNote> : <p role="status" className="text-xs text-ink-muted">{c.loading}</p>;
  }
  const { info, ob } = load;
  const isOwner = info.user.role === "owner";
  const ready = !PRE_SANDBOX.includes(ob.status);
  const reviewedOn = ob.submitted_at ? new Date(ob.submitted_at).toLocaleDateString(lang) : "";

  let body: React.ReactNode;
  if (!isOwner && !ready) {
    body = <InfoNote>{c.notOwner}</InfoNote>;
  } else if (!ob.steps.email_verified) {
    body = <EmailStep email={info.user.email} onDone={() => void refresh()} />;
  } else if (!ob.steps.two_factor_enrolled) {
    body = (
      <Card title={c.twoFactor.title} icon={<ShieldAlert size={16} className="text-warning" aria-hidden="true" />}>
        <p className="mb-4 text-xs text-ink-muted">{c.twoFactor.body}</p>
        <button type="button" onClick={() => void signOut()} className={ghostButton}>{c.twoFactor.action}</button>
      </Card>
    );
  } else if (!ob.steps.phone_verified) {
    body = <PhoneStep phone={ob.profile?.phone ?? ""} onDone={() => void refresh()} />;
  } else if (ob.status === "sandbox") {
    body = (
      <ReviewRequest
        title={c.sandbox.title}
        body={c.sandbox.body}
        label={c.sandbox.request}
        onDone={() => void refresh()}
        extra={<Link href="/developers" className={ghostButton}>{c.sandbox.keys}</Link>}
      />
    );
  } else if (ob.status === "under_review") {
    body = (
      <Card title={c.review.title} icon={<Clock size={16} className="text-info" aria-hidden="true" />}>
        <p className="mb-4 text-xs text-ink-muted">{c.review.body.replace("{date}", reviewedOn ? ` (${reviewedOn})` : "")}</p>
        <Link href="/dashboard" className={ghostButton}>{c.review.sandbox}</Link>
      </Card>
    );
  } else if (ob.status === "rejected") {
    body = (
      <ReviewRequest
        title={c.rejected.title}
        icon={<ShieldAlert size={16} className="text-danger" aria-hidden="true" />}
        label={c.rejected.again}
        onDone={() => void refresh()}
        body={
          <>
            {ob.decision_reason && (
              <p className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-ink">
                <span className="font-semibold">{c.rejected.reasonLabel}: </span>
                {ob.decision_reason}
              </p>
            )}
            <p>{c.rejected.body}</p>
          </>
        }
        extra={<Link href="/dashboard" className={ghostButton}>{c.goConsole}</Link>}
      />
    );
  } else {
    body = (
      <Card title={c.approved.title} icon={<CheckCircle2 size={16} className="text-accent" aria-hidden="true" />}>
        <p className="mb-4 text-xs text-ink-muted">{c.approved.body}</p>
        <Link href="/developers" className={linkButton}>{c.sandbox.keys}</Link>
      </Card>
    );
  }

  return (
    <>
      <Stepper ob={ob} />
      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
      {body}
      <ProfileSummary ob={ob} />
      {ready && (
        <p className="mt-6 text-center text-xs">
          <Link href="/dashboard" className="text-accent hover:underline">{c.goConsole}</Link>
        </p>
      )}
    </>
  );
}

function Frame() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col">
      <SessionHeader />
      <main className="flex flex-1 justify-center px-4 pb-10">
        <div className="w-full max-w-xl">
          <h1 className="mb-6 text-lg font-semibold text-ink">{t.onboarding.title}</h1>
          <Wizard />
        </div>
      </main>
    </div>
  );
}

export function OnboardingView() {
  return (
    <LanguageProvider>
      <Frame />
    </LanguageProvider>
  );
}
