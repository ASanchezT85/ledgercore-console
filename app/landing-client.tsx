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

const API_URL = "https://ledgercore-api.sanchezavila.com";

const SDK_SNIPPET = `import { LedgerCore, Money } from "@ledgercore/sdk";

const lc = new LedgerCore({
  apiKey: process.env.LEDGERCORE_API_KEY,
  apiSecret: process.env.LEDGERCORE_API_SECRET,
  baseUrl: "${API_URL}",
});
const usd = (v: string) => Money.fromDecimal(v, "USD", 2);

await lc.transactions.create({
  ledger_id: ledger.id,
  idempotency_key: "dep-0001",
  description: "Customer USD deposit",
  postings: [
    { account_id: cash.id,   direction: "DEBIT",  amount: usd("100.00") },
    { account_id: wallet.id, direction: "CREDIT", amount: usd("97.00") },
    { account_id: fees.id,   direction: "CREDIT", amount: usd("3.00") },
  ],
});`;

// The three postings of SDK_SNIPPET, as the engine books them.
const ENTRY = [
  { debit: "100.00", credit: "" },
  { debit: "", credit: "97.00" },
  { debit: "", credit: "3.00" },
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
          <CtaSecondary href="/docs">{t.hero.ctaSecondary}</CtaSecondary>
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
          <div className="min-w-0 overflow-hidden rounded-(--radius-card) border border-edge bg-surface lg:col-span-3">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <span className="font-mono text-[11px] text-ink-faint">
                POST /v1/transactions
              </span>
              <span className="text-[10px] tracking-widest text-ink-faint uppercase">
                @ledgercore/sdk
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-ink-muted">
              <code>{SDK_SNIPPET}</code>
            </pre>
          </div>
          <div className="self-start overflow-hidden rounded-(--radius-card) border border-edge bg-surface lg:col-span-2">
            <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent">
                <CheckCircle2 size={12} aria-hidden="true" />
                201 Created · posted
              </span>
              <span className="text-[10px] tracking-widest text-ink-faint uppercase">
                USD
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-[11px] tracking-wider text-ink-faint uppercase">
                  <th className="px-4 py-2.5 font-medium">{t.how.account}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.how.debit}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.how.credit}</th>
                </tr>
              </thead>
              <tbody>
                {ENTRY.map((row, i) => (
                  <tr key={t.how.accounts[i]} className="border-b border-edge">
                    <td className="px-4 py-3 text-ink">{t.how.accounts[i]}</td>
                    <td className="num px-4 py-3 text-right text-ink">{row.debit}</td>
                    <td className="num px-4 py-3 text-right text-ink">{row.credit}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-accent">
                  <td className="px-4 py-3">{t.how.total}</td>
                  <td className="num px-4 py-3 text-right">100.00</td>
                  <td className="num px-4 py-3 text-right">100.00</td>
                </tr>
              </tfoot>
            </table>
            <p className="border-t border-edge px-4 py-3 text-xs leading-relaxed text-ink-faint">
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
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {t.tryIt.steps.map(({ title, body }, i) => (
            <li
              key={title}
              className="rounded-(--radius-card) border border-edge bg-surface p-6"
            >
              <span className="num text-sm font-semibold text-accent">{i + 1}</span>
              <h3 className="mt-2 text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <CtaPrimary href="/signup">{t.tryIt.ctaPrimary}</CtaPrimary>
          <CtaSecondary href="/docs/quickstart">{t.tryIt.ctaSecondary}</CtaSecondary>
        </div>
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
