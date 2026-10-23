// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ErrorNote, InfoNote } from "@/components/auth-shell";
import { LanguageProvider, useLang } from "@/components/language";
import { IntegrationsPanel } from "./integrations-panel";
import { SessionHeader } from "@/components/session-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  decide,
  type Decision,
  DECISIONS_FOR,
  getAccount,
  listAccounts,
  type QueueFilter,
  type ReviewAccount,
} from "@/lib/backoffice";
import type { AccountStatus } from "@/lib/onboarding";
import { getSessionInfo, IdentityError } from "@/lib/session";

const FILTERS: QueueFilter[] = ["under_review", "approved", "rejected", "suspended", "sandbox", "all"];

const TONE: Record<AccountStatus, BadgeTone> = {
  registered: "slate",
  email_verified: "slate",
  mfa_enrolled: "slate",
  sandbox: "violet",
  under_review: "amber",
  approved: "emerald",
  rejected: "red",
  suspended: "red",
};

type Access = "checking" | "allowed" | "denied";

function StatusBadge({ status }: { status: AccountStatus }) {
  const { t } = useLang();
  return (
    <Badge tone={TONE[status] ?? "slate"} dot>
      {t.backoffice.status[status] ?? status}
    </Badge>
  );
}

function when(iso: string | null, lang: string): string {
  return iso ? new Date(iso).toLocaleString(lang) : "—";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-xs">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function Detail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const { t, lang } = useLang();
  const c = t.backoffice;
  const d = c.detail;
  const [acct, setAcct] = useState<ReviewAccount | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAcct(await getAccount(id));
    } catch (err) {
      setError(err instanceof Error && err.message === "network" ? c.errNetwork : c.errGeneric);
    }
  }, [id, c.errNetwork, c.errGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(decision: Decision) {
    if (busy || !reason.trim()) return;
    setBusy(decision);
    setError(null);
    setNotice(null);
    try {
      await decide(id, decision, reason.trim());
      await load(); // the decision answer carries no history
      setReason("");
      setNotice(d.done);
      onChanged();
    } catch (err) {
      if (err instanceof IdentityError && err.status === 409) {
        setNotice(d.conflict);
        await load();
        onChanged();
      } else if (err instanceof IdentityError && err.status === 403) setError(d.forbidden);
      else if (err instanceof IdentityError && err.status === 400) setError(err.message);
      else setError(err instanceof Error && err.message === "network" ? c.errNetwork : c.errGeneric);
    } finally {
      setBusy(null);
    }
  }

  if (!acct) return error ? <ErrorNote>{error}</ErrorNote> : <p role="status" className="text-xs text-ink-muted">{c.loading}</p>;
  const p = acct.profile;
  const actions = DECISIONS_FOR[acct.status] ?? [];
  const steps: [string, boolean][] = [
    [d.email, acct.steps.email_verified],
    [d.twoFactor, acct.steps.two_factor_enrolled],
    [d.phoneStep, acct.steps.phone_verified],
  ];
  return (
    <section className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
        <ArrowLeft size={13} aria-hidden="true" />
        {d.back}
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-ink">{acct.name}</h2>
        <StatusBadge status={acct.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">{d.data}</h3>
          <dl>
            <Row label={d.owner}>{acct.owner_email}</Row>
            {p && (
              <>
                <Row label={d.kind}>{p.kind === "company" ? d.company : d.person}</Row>
                <Row label={d.legalName}>{p.legal_name}</Row>
                {p.registration_number && <Row label={d.registration}>{p.registration_number}</Row>}
                <Row label={d.taxId}>{p.tax_id}</Row>
                <Row label={d.address}>
                  {p.address_line}, {p.city}, {p.region}, {p.postal_code}, {p.country}
                </Row>
                {p.website && <Row label={d.website}>{p.website}</Row>}
                <Row label={d.phone}>{p.phone}</Row>
              </>
            )}
          </dl>
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">{d.verifications}</h3>
          <ul className="space-y-1.5 text-xs">
            {steps.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2">
                <Badge tone={ok ? "emerald" : "amber"}>{ok ? d.verified : d.missing}</Badge>
                <span className="text-ink">{label}</span>
              </li>
            ))}
          </ul>
          {acct.decided_at && (
            <p className="mt-4 text-xs text-ink-muted">
              <span className="font-medium text-ink">{d.lastDecision}: </span>
              {when(acct.decided_at, lang)}
              {acct.decision_reason ? ` — ${acct.decision_reason}` : ""}
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">{d.decision}</h3>
        {actions.length === 0 ? (
          <p className="text-xs text-ink-muted">{d.noActions}</p>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">{d.reason}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 py-2.5 text-sm text-ink focus:border-accent/60"
              />
              <span className="mt-1 block text-[11px] text-ink-faint">{d.reasonHint}</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={!reason.trim() || busy !== null}
                  onClick={() => void act(a)}
                  className={`inline-flex h-10 items-center justify-center rounded-(--radius-control) px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    a === "approve" || a === "reinstate"
                      ? "bg-accent-deep text-on-accent hover:bg-accent"
                      : "border border-danger/50 text-danger hover:bg-danger/10"
                  }`}
                >
                  {busy === a ? d.busy : d[a]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 space-y-2" aria-live="polite">
          {error && <ErrorNote>{error}</ErrorNote>}
          {notice && <InfoNote>{notice}</InfoNote>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">{d.history}</h3>
        {!acct.history || acct.history.length === 0 ? (
          <p className="text-xs text-ink-muted">{d.noHistory}</p>
        ) : (
          <ol className="space-y-1.5 text-xs">
            {acct.history.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-ink-muted">
                <time className="font-mono text-ink-faint" dateTime={e.occurred_at}>{when(e.occurred_at, lang)}</time>
                <span className="text-ink">{c.events[e.action as keyof typeof c.events] ?? e.action}</span>
                {e.action === "account.status_changed" && e.after?.status && (
                  <span>
                    {c.status[(e.before?.status ?? "registered") as AccountStatus] ?? e.before?.status} → {c.status[e.after.status as AccountStatus] ?? e.after.status}
                  </span>
                )}
                {e.after?.channel && <span>({String(e.after.channel)})</span>}
                {e.after?.reason && <span>“{e.after.reason}”</span>}
                <span className="text-ink-faint">
                  {d.by} {e.actor.startsWith("user:") ? e.actor.slice(0, 13) + "…" : e.actor}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Desk() {
  const router = useRouter();
  const { t, lang } = useLang();
  const c = t.backoffice;
  const [access, setAccess] = useState<Access>("checking");
  const [filter, setFilter] = useState<QueueFilter>("under_review");
  const [list, setList] = useState<ReviewAccount[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"accounts" | "integrations">("accounts");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const info = await getSessionInfo(true);
      if (!info) {
        router.replace("/login?reason=expired");
        return;
      }
      setAccess(info.user.role === "platform_operator" ? "allowed" : "denied");
    })();
  }, [router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setList(await listAccounts(filter));
    } catch (err) {
      if (err instanceof IdentityError && err.status === 401) router.replace("/login?reason=expired");
      else if (err instanceof IdentityError && err.status === 403) setAccess("denied");
      else setError(err instanceof Error && err.message === "network" ? c.errNetwork : c.errGeneric);
    }
  }, [filter, router, c.errNetwork, c.errGeneric]);

  useEffect(() => {
    if (access === "allowed") void refresh();
  }, [access, refresh]);

  if (access === "checking") return <p role="status" className="text-xs text-ink-muted">{c.loading}</p>;
  if (access === "denied") {
    return (
      <div className="space-y-3">
        <InfoNote>{c.notAllowed}</InfoNote>
        <Link href="/dashboard" className="text-xs text-accent hover:underline">
          {t.onboarding.goConsole}
        </Link>
      </div>
    );
  }
  if (selected) return <Detail id={selected} onBack={() => setSelected(null)} onChanged={() => void refresh()} />;

  const tabs = (
    <div role="group" aria-label="Back office" className="mb-4 flex gap-1.5">
      {(["accounts", "integrations"] as const).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={tab === id}
          onClick={() => setTab(id)}
          className={`inline-flex h-9 items-center rounded-(--radius-control) border px-3 text-xs font-medium transition-colors ${
            tab === id ? "border-accent/60 bg-accent-soft text-accent" : "border-edge-strong text-ink-muted hover:text-ink"
          }`}
        >
          {id === "accounts" ? (lang === "es" ? "Cuentas" : "Accounts") : lang === "es" ? "Integraciones" : "Integrations"}
        </button>
      ))}
    </div>
  );
  if (tab === "integrations")
    return (
      <>
        {tabs}
        <IntegrationsPanel />
      </>
    );

  return (
    <>
      {tabs}
      <div role="group" aria-label={c.filtersAria} className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`inline-flex h-9 items-center rounded-(--radius-control) border px-3 text-xs font-medium transition-colors ${
              filter === f ? "border-accent/60 bg-accent-soft text-accent" : "border-edge-strong text-ink-muted hover:text-ink"
            }`}
          >
            {c.filters[f]}
          </button>
        ))}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!list && !error && <p role="status" className="text-xs text-ink-muted">{c.loading}</p>}
      {list && list.length === 0 && <p className="text-xs text-ink-muted">{c.empty}</p>}
      {list && list.length > 0 && (
        <div className="rounded-(--radius-card) border border-edge bg-surface/80">
          <Table>
            <THead>
              <TH>{c.columns.account}</TH>
              <TH>{c.columns.owner}</TH>
              <TH>{c.columns.country}</TH>
              <TH>{c.columns.submitted}</TH>
              <TH>{c.columns.status}</TH>
            </THead>
            <TBody>
              {list.map((a) => (
                <TR key={a.tenant_id}>
                  <TD>
                    <button type="button" onClick={() => setSelected(a.tenant_id)} className="text-left font-medium text-accent hover:underline">
                      {a.name}
                    </button>
                  </TD>
                  <TD>{a.owner_email}</TD>
                  <TD>{a.profile?.country ?? "—"}</TD>
                  <TD>{when(a.submitted_at, lang)}</TD>
                  <TD>
                    <StatusBadge status={a.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
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
        <div className="w-full max-w-5xl">
          <h1 className="text-lg font-semibold text-ink">{t.backoffice.title}</h1>
          <p className="mb-6 text-xs text-ink-muted">{t.backoffice.subtitle}</p>
          <Desk />
        </div>
      </main>
    </div>
  );
}

export function BackOfficeView() {
  return (
    <LanguageProvider>
      <Frame />
    </LanguageProvider>
  );
}
