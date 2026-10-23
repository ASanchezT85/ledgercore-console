// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Package } from "lucide-react";
import { LanguageProvider, LangToggle, useLang } from "@/components/language";
import { BrandLockup } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/lib/i18n";
import { API_BASE, CodeBlock } from "../docs-ui";

// lucide-react v1 dropped brand icons; GitHub mark (simple-icons path, 24x24).
function Github({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const TS_INSTALL = `npm install @ledgercore/sdk`;

const TS_QUICKSTART = `import { LedgerCore, Money } from "@ledgercore/sdk";

const lc = new LedgerCore({ apiKey: process.env.LEDGERCORE_API_KEY, apiSecret: process.env.LEDGERCORE_API_SECRET, baseUrl: "${API_BASE}" });
const ledger = await lc.ledgers.create({ name: "main" });
const wallet = await lc.accounts.create({ ledger_id: ledger.id, name: "customer:42:wallet", type: "liability", normal_balance: "CREDIT" });
const txn = await lc.transactions.create({ ledger_id: ledger.id, postings: [/* debits = credits, Money.fromDecimal("100.50","USD",2) */] });`;

const PHP_INSTALL = `composer require ledgercore/sdk`;

const PHP_QUICKSTART = `use LedgerCore\\LedgerCore;
use LedgerCore\\Money;

$lc = new LedgerCore(['api_key' => getenv('LEDGERCORE_API_KEY'), 'api_secret' => getenv('LEDGERCORE_API_SECRET'), 'base_url' => '${API_BASE}']);
$ledger = $lc->ledgers->create(['name' => 'main']);
$txn = $lc->transactions->create(['ledger_id' => $ledger['id'], 'postings' => [/* Money::fromDecimal('100.50','USD',2) */]]);`;

interface SdkLinks {
  registry: { label: string; href: string };
  github: { label: string; href: string };
}

const TS_LINKS: SdkLinks = {
  registry: {
    label: "npmjs.com/package/@ledgercore/sdk",
    href: "https://www.npmjs.com/package/@ledgercore/sdk",
  },
  github: {
    label: "github.com/ASanchezT85/ledgercore-sdk-typescript",
    href: "https://github.com/ASanchezT85/ledgercore-sdk-typescript",
  },
};

const PHP_LINKS: SdkLinks = {
  registry: {
    label: "packagist.org/packages/ledgercore/sdk",
    href: "https://packagist.org/packages/ledgercore/sdk",
  },
  github: {
    label: "github.com/ASanchezT85/ledgercore-sdk-php",
    href: "https://github.com/ASanchezT85/ledgercore-sdk-php",
  },
};

interface SdksCopy {
  badge: string;
  title: string;
  subtitle: string;
  back: string;
  tsTitle: string;
  tsBody: string;
  phpTitle: string;
  phpBody: string;
  install: string;
  quickstart: string;
  features: string[];
  linksLabel: string;
  copy: string;
  copied: string;
  footer: string;
}

const ES: SdksCopy = {
  badge: "SDKs oficiales",
  title: "SDKs: TypeScript y PHP",
  subtitle:
    "Los dos SDKs oficiales cubren toda la superficie de la API con la misma semántica: firma automática de cada request con tu credencial API, Money helpers sin redondeo silencioso, idempotencia de primera clase, autopaginación y verificación de firmas de webhook en tiempo constante.",
  back: "Docs",
  tsTitle: "TypeScript — @ledgercore/sdk",
  tsBody:
    "Node 18+ y navegadores, fetch nativo, cero dependencias en runtime. Tipado completo, ESM + CJS.",
  phpTitle: "PHP — ledgercore/sdk",
  phpBody:
    "PHP 8.1+, cURL nativo, cero dependencias obligatorias en runtime (el transporte es una interfaz: puedes enchufar tu propio cliente PSR-18).",
  install: "Instalación",
  quickstart: "Quickstart (5 líneas)",
  features: [
    "Firma gestionada: llave + secreto de tu credencial API (ak_ / as_); el SDK genera timestamp y nonce y firma cada request con HMAC-SHA256. Las llaves lk_ antiguas siguen funcionando hasta el 2027-02-01 (obsoletas).",
    "Dinero siempre como strings de unidades menores: Money.fromDecimal / toDecimal, error explícito ante precisión imposible.",
    "Idempotencia: pasa tu key o el SDK genera un UUID v4; los retries nunca duplican dinero.",
    "Paginación: list({ limit, cursor }) + autopaginación listAll() en todas las colecciones.",
    "Webhooks: verificación de X-LedgerCore-Signature en tiempo constante, ventana anti-replay de 5 min, rotación con múltiples v1.",
    "Errores tipados con status, code y request_id sobre el catálogo estable.",
  ],
  linksLabel: "Paquete y código",
  copy: "Copiar",
  copied: "Copiado",
  footer: "infraestructura financiera",
};

const EN: SdksCopy = {
  badge: "Official SDKs",
  title: "SDKs: TypeScript and PHP",
  subtitle:
    "Both official SDKs cover the full API surface with identical semantics: automatic request signing with your API credential, Money helpers with no silent rounding, first-class idempotency, auto-pagination and constant-time webhook signature verification.",
  back: "Docs",
  tsTitle: "TypeScript — @ledgercore/sdk",
  tsBody:
    "Node 18+ and browsers, native fetch, zero runtime dependencies. Fully typed, ESM + CJS.",
  phpTitle: "PHP — ledgercore/sdk",
  phpBody:
    "PHP 8.1+, native cURL, zero mandatory runtime dependencies (the transport is an interface — plug in your own PSR-18 client).",
  install: "Install",
  quickstart: "Quickstart (5 lines)",
  features: [
    "Signing handled for you: the key + secret of your API credential (ak_ / as_); the SDK generates the timestamp and nonce and signs every request with HMAC-SHA256. The old lk_ keys keep working until 2027-02-01 (deprecated).",
    "Money always as minor-unit strings: Money.fromDecimal / toDecimal, explicit error on impossible precision.",
    "Idempotency: pass your key or the SDK generates a UUID v4; retries never duplicate money.",
    "Pagination: list({ limit, cursor }) plus listAll() auto-pagination on every collection.",
    "Webhooks: constant-time X-LedgerCore-Signature verification, 5-minute replay window, rotation with multiple v1 entries.",
    "Typed errors with status, code and request_id over the stable catalog.",
  ],
  linksLabel: "Package and source",
  copy: "Copy",
  copied: "Copied",
  footer: "financial infrastructure",
};

const COPY: Record<Lang, SdksCopy> = { es: ES, en: EN };

function SdkCard({
  title,
  body,
  install,
  quickstart,
  links,
  c,
}: {
  title: string;
  body: string;
  install: string;
  quickstart: string;
  links: SdkLinks;
  c: SdksCopy;
}) {
  return (
    <section className="rounded-(--radius-card) border border-edge bg-surface/70 p-6">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{body}</p>
      <div className="mt-4 space-y-3">
        <CodeBlock label={c.install} code={install} copyLabel={c.copy} copiedLabel={c.copied} />
        <CodeBlock label={c.quickstart} code={quickstart} copyLabel={c.copy} copiedLabel={c.copied} />
      </div>
      <p className="mt-4 mb-2 text-[11px] font-medium tracking-wider text-ink-faint uppercase">
        {c.linksLabel}
      </p>
      <ul className="space-y-1.5">
        <li>
          <a
            href={links.registry.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-accent hover:underline"
          >
            <Package size={13} aria-hidden="true" />
            {links.registry.label}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        </li>
        <li>
          <a
            href={links.github.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-accent hover:underline"
          >
            <Github size={13} aria-hidden="true" />
            {links.github.label}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        </li>
      </ul>
    </section>
  );
}

function SdksContent() {
  const { lang } = useLang();
  const c = COPY[lang];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="LedgerCore">
            <BrandLockup size={30} />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-accent"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {c.back}
          </Link>
        </div>
        <LangToggle />
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-24">
        <Badge tone="emerald" className="mb-4">
          {c.badge}
        </Badge>
        <h1 className="max-w-2xl font-serif text-[34px] leading-tight tracking-[-0.01em] text-ink">{c.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{c.subtitle}</p>

        <ul className="mt-6 space-y-1.5">
          {c.features.map((f) => (
            <li key={f} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-10 space-y-8">
          <SdkCard
            title={c.tsTitle}
            body={c.tsBody}
            install={TS_INSTALL}
            quickstart={TS_QUICKSTART}
            links={TS_LINKS}
            c={c}
          />
          <SdkCard
            title={c.phpTitle}
            body={c.phpBody}
            install={PHP_INSTALL}
            quickstart={PHP_QUICKSTART}
            links={PHP_LINKS}
            c={c}
          />
        </div>
      </main>

      <footer className="border-t border-edge px-6 py-6 text-center">
        <p className="text-[11px] tracking-wide text-ink-faint">LedgerCore — {c.footer}</p>
      </footer>
    </div>
  );
}

export function SdksView() {
  return (
    <LanguageProvider>
      <SdksContent />
    </LanguageProvider>
  );
}
