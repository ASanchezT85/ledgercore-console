// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookLock,
  CheckCircle2,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { LanguageProvider, useLang } from "@/components/language";
import { PublicFooter, PublicHeader } from "@/components/public-header";

const CURL_SNIPPET = `curl -X POST http://localhost:8081/v1/transactions \\
  -H "X-Tenant-Id: 11111111-1111-1111-1111-111111111111" \\
  -H "Idempotency-Key: dep-0001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ledger_id": "'$LEDGER'",
    "description": "Customer USD deposit",
    "postings": [
      { "account_id": "'$CASH'",   "direction": "DEBIT",  "amount": { "asset": "USD", "amount": "10000" } },
      { "account_id": "'$WALLET'", "direction": "CREDIT", "amount": { "asset": "USD", "amount": "9700" } },
      { "account_id": "'$FEES'",   "direction": "CREDIT", "amount": { "asset": "USD", "amount": "300" } }
    ]
  }'`;

// Real 201 response from the local compose stack (the exact request above).
const RESPONSE_SNIPPET = `{
  "id": "01a155df-47e5-73c8-9958-fc0c8bccc30c",
  "ledger_id": "01a155df-469e-79dc-abbd-ac1a4454c359",
  "idempotency_key": "dep-0001",
  "description": "Customer USD deposit",
  "status": "posted",
  "postings": [
    { "id": "01a155df-47e5-73c1-bc10-9dd491f1001c", "account_id": "01a155df-46fe-74b2-8c7f-f55ad7a34167", "direction": "DEBIT",  "amount": { "asset": "USD", "amount": "10000" } },
    { "id": "01a155df-47e5-73c2-8ba7-e4923596fd47", "account_id": "01a155df-4769-7149-a825-0b1644219b50", "direction": "CREDIT", "amount": { "asset": "USD", "amount": "9700" } },
    { "id": "01a155df-47e5-73c3-888a-d4ab6ef0b5e4", "account_id": "01a155df-47b0-78ab-918f-a78ec0a59d75", "direction": "CREDIT", "amount": { "asset": "USD", "amount": "300" } }
  ],
  "metadata": {},
  "reversed_by": null,
  "reverses": null,
  "adjusts_period_id": null,
  "effective_at": "2026-10-19T20:34:18.725247785Z",
  "created_at": "2026-10-19T20:34:18.725247785Z",
  "posted_at": "2026-10-19T20:34:18.725247785Z"
}`;

const REPO = "https://github.com/ASanchezT85/ledgercore";

// Same commands as the README quickstart and "Demo data"; notes in i18n tryIt.notes.
const TRY_STEPS = [
  `git clone ${REPO}.git && cd ledgercore
docker compose -f infra/compose/docker-compose.yml up -d --build`,
  "bash examples/demo-data.sh",
  "bash examples/golden-scenarios.sh",
] as const;

const TRUST_ICONS = [BookLock, ShieldCheck, Layers] as const;

function CtaPrimary({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-(--radius-control) bg-accent-deep px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-accent"
    >
      {children}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

function CtaSecondary({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-(--radius-control) border border-edge-strong px-6 text-sm font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent"
    >
      {children}
    </Link>
  );
}

function LandingContent() {
  const { t } = useLang();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <PublicHeader />

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-24 sm:pt-24">
        <p className="lc-enter mb-5 text-xs font-medium tracking-widest text-ink-faint uppercase">
          {t.hero.badge}
        </p>
        <h1 className="lc-enter max-w-3xl font-serif text-[42px] leading-[1.1] tracking-[-0.01em] text-ink [--lc-delay:60ms] sm:text-[56px]">
          {t.hero.titlePre}
          <span className="text-accent">{t.hero.titleHighlight}</span>
          {t.hero.titlePost}
        </h1>
        <p className="lc-enter mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted [--lc-delay:120ms]">
          {t.hero.subtitle}
        </p>
        <div className="lc-enter mt-9 flex flex-wrap items-center gap-3 [--lc-delay:180ms]">
          <CtaPrimary href="#try">{t.hero.ctaPrimary}</CtaPrimary>
          <CtaSecondary href={REPO}>{t.hero.ctaSecondary}</CtaSecondary>
        </div>
      </section>

      {/* Benchmark (docs/benchmark.md) */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {t.bench.items.map((s) => (
            <div
              key={s.value}
              className="rounded-(--radius-card) border border-edge bg-surface/70 p-6"
            >
              <p className="num text-3xl font-semibold tracking-tight text-accent">
                {s.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {s.label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-faint">
          {t.bench.foot}
          <Link
            href={`${REPO}/blob/main/docs/benchmark.md`}
            className="font-medium text-accent hover:underline"
          >
            {t.bench.link}
          </Link>
        </p>
      </section>

      {/* Scenarios */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="lc-reveal mb-8 max-w-2xl">
          <h2 className="font-serif text-[30px] leading-tight tracking-[-0.01em] text-ink">
            {t.scenarios.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {t.scenarios.subtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {t.scenarios.items.map(({ role, title, scenario, answer }) => (
            <article
              key={title}
              className="flex flex-col rounded-(--radius-card) border border-edge bg-surface/70 p-6 transition-colors hover:border-accent/40"
            >
              <span className="text-[11px] font-medium tracking-widest text-ink-faint uppercase">
                {role}
              </span>
              <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {scenario}
              </p>
              <p className="mt-4 border-t border-edge pt-4 text-sm leading-relaxed text-ink">
                <span className="mr-2 font-semibold text-ink-faint">
                  {t.scenarios.answerLabel}
                </span>
                {answer}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-faint">
          {t.scenarios.footNote}
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="lc-reveal mb-8 max-w-2xl">
          <h2 className="font-serif text-[30px] leading-tight tracking-[-0.01em] text-ink">
            {t.how.title}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t.how.subtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="overflow-hidden rounded-(--radius-card) border border-edge bg-surface lg:col-span-3">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <span className="font-mono text-[11px] text-ink-faint">
                POST /v1/transactions
              </span>
              <span className="text-[10px] tracking-widest text-ink-faint uppercase">
                request
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
              <code>{CURL_SNIPPET}</code>
            </pre>
          </div>
          <div className="overflow-hidden rounded-(--radius-card) border border-edge bg-surface lg:col-span-2">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent">
                <CheckCircle2 size={12} aria-hidden="true" />
                201 Created · balanced
              </span>
              <span className="text-[10px] tracking-widest text-ink-faint uppercase">
                response
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
              <code>{RESPONSE_SNIPPET}</code>
            </pre>
            <p className="border-t border-edge px-4 py-3 text-[11px] leading-relaxed text-ink-faint">
              {t.how.responseNote}
            </p>
          </div>
        </div>
        <p className="mt-6">
          <Link
            href="/docs/quickstart"
            className="text-sm font-medium text-accent hover:underline"
          >
            {t.how.quickstartCta}
          </Link>
        </p>
      </section>

      {/* Guarantees (README "What LedgerCore guarantees") */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="lc-reveal mb-8 max-w-2xl">
          <h2 className="font-serif text-[30px] leading-tight tracking-[-0.01em] text-ink">
            {t.guarantees.title}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t.guarantees.subtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {t.guarantees.items.map(({ title, body }) => (
            <div key={title} className="border-t border-edge-strong pt-4">
              <h3 className="text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8">
          <Link
            href={`${REPO}#what-ledgercore-guarantees`}
            className="text-sm font-medium text-accent hover:underline"
          >
            {t.guarantees.link}
          </Link>
        </p>
      </section>

      {/* Try it */}
      <section id="try" className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 pb-20">
        <div className="lc-reveal mb-8 max-w-2xl">
          <h2 className="font-serif text-[30px] leading-tight tracking-[-0.01em] text-ink">
            {t.tryIt.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {t.tryIt.subtitle}
          </p>
        </div>
        <ol className="grid grid-cols-1 gap-4">
          {TRY_STEPS.map((cmd, i) => (
            <li
              key={cmd}
              className="overflow-hidden rounded-(--radius-card) border border-edge bg-surface"
            >
              <p className="border-b border-edge px-4 py-2.5 text-sm text-ink-muted">
                <span className="num mr-2 font-semibold text-accent">{i + 1}</span>
                {t.tryIt.notes[i]}
              </p>
              <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-ink">
                <code>{cmd}</code>
              </pre>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-ink-faint">{t.tryIt.consoleNote}</p>
      </section>

      {/* Trust strip */}
      <section className="border-y border-edge bg-surface/50">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-8">
          {t.trust.map((text, i) => {
            const Icon = TRUST_ICONS[i] ?? BookLock;
            return (
              <span
                key={text}
                className="inline-flex items-center gap-2.5 text-sm font-medium text-ink-muted"
              >
                <Icon size={16} className="text-accent" aria-hidden="true" />
                {text}
              </span>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24 text-center">
        <h2 className="mx-auto max-w-2xl font-serif text-[38px] leading-tight tracking-[-0.01em] text-ink">
          {t.finalCta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">
          {t.finalCta.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CtaPrimary href="/signup">{t.finalCta.ctaPrimary}</CtaPrimary>
          <CtaSecondary href="/dashboard">{t.finalCta.ctaSecondary}</CtaSecondary>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}

export default function LandingClient() {
  return (
    <LanguageProvider>
      <LandingContent />
    </LanguageProvider>
  );
}
