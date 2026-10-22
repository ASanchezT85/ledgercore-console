// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Terminal } from "lucide-react";
import { LangToggle, LanguageProvider, useLang } from "@/components/language";
import { BrandLockup } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/lib/i18n";
import { curlSign } from "../guias/autenticacion/content";

const API = "http://localhost:8080";

// ---- curls (shared between languages; shapes follow ledger.v1.yaml) -------

const CURL_SIGN_ES = curlSign(
  "el Host que envía curl (host:puerto)",
  "lc MÉTODO /ruta[?query] [cuerpo-json] [idempotency-key]   (query, si hay, ya ordenada)",
);

const CURL_SIGN_EN = curlSign(
  "the Host curl sends (host:port)",
  "lc METHOD /path[?query] [json-body] [idempotency-key]   (query, if any, already sorted)",
);

const RESP_SIGN = `{ "data": [] }`;

const CURL_LEDGER = `LEDGER_ID=$(lc POST /v1/ledgers \\
  '{ "name": "main", "description": "Primary operating ledger" }' | jq -r .id)`;

const RESP_LEDGER = `{
  "id": "1f0a6a2e-9c1b-7f2e-8a11-3c5d7e9f0b21",
  "name": "main",
  "description": "Primary operating ledger",
  "environment": "sandbox",
  "metadata": {},
  "created_at": "2026-07-28T12:00:00Z"
}`;

const CURL_ACCOUNTS = `mkacct () {
  lc POST /v1/accounts \\
    "{ \\"ledger_id\\": \\"$LEDGER_ID\\", \\"name\\": \\"$1\\", \\"type\\": \\"$2\\", \\"normal_balance\\": \\"$3\\" }" | jq -r .id
}

CASH_ID=$(mkacct   "assets:cash"              asset     DEBIT)
WALLET_ID=$(mkacct "customer:cust_42:wallet"  liability CREDIT)
FEES_ID=$(mkacct   "revenue:fees"             revenue   CREDIT)`;

const RESP_ACCOUNTS = `{
  "id": "2b1c7d3f-0a2b-7c4d-9e50-6f8a0b1c2d3e",
  "ledger_id": "1f0a6a2e-9c1b-7f2e-8a11-3c5d7e9f0b21",
  "name": "customer:cust_42:wallet",
  "type": "liability",
  "normal_balance": "CREDIT",
  "status": "active",
  "metadata": {},
  "created_at": "2026-07-28T12:01:00Z"
}`;

const CURL_DEPOSIT = `lc POST /v1/transactions "{
    \\"ledger_id\\": \\"$LEDGER_ID\\",
    \\"idempotency_key\\": \\"dep-2026-0001\\",
    \\"description\\": \\"Customer USD deposit\\",
    \\"postings\\": [
      { \\"account_id\\": \\"$CASH_ID\\",   \\"direction\\": \\"DEBIT\\",  \\"amount\\": { \\"asset\\": \\"USD\\", \\"amount\\": \\"10000\\" } },
      { \\"account_id\\": \\"$WALLET_ID\\", \\"direction\\": \\"CREDIT\\", \\"amount\\": { \\"asset\\": \\"USD\\", \\"amount\\": \\"9700\\" } },
      { \\"account_id\\": \\"$FEES_ID\\",   \\"direction\\": \\"CREDIT\\", \\"amount\\": { \\"asset\\": \\"USD\\", \\"amount\\": \\"300\\" } }
    ]
  }" | jq`;

const RESP_DEPOSIT = `{
  "id": "3c2d8e0f-1a2b-7c4d-9e5f-7a8b9c0d1e2f",
  "status": "posted",
  "idempotency_key": "dep-2026-0001",
  "postings": [
    { "account_id": "...", "direction": "DEBIT",  "amount": { "asset": "USD", "amount": "10000" } },
    { "account_id": "...", "direction": "CREDIT", "amount": { "asset": "USD", "amount": "9700" } },
    { "account_id": "...", "direction": "CREDIT", "amount": { "asset": "USD", "amount": "300" } }
  ],
  "posted_at": "2026-07-28T12:05:00Z"
}`;

const CURL_BALANCES = `lc GET /v1/accounts/$WALLET_ID/balances | jq

lc GET "/v1/trial-balance?ledger_id=$LEDGER_ID" | jq .totals`;

const RESP_BALANCES = `{ "data": [ { "asset": "USD", "exponent": 2, "posted": "9700",
    "pending": "0", "available": "9700", "held": "0", "version": 1 } ] }

[ { "asset": "USD", "debits": "10000", "credits": "10000", "balanced": true } ]`;

const CURL_REPLAY = `LC_CURL_FLAGS=-si lc POST /v1/transactions "{
    \\"ledger_id\\": \\"$LEDGER_ID\\",
    \\"idempotency_key\\": \\"dep-2026-0001\\",
    \\"description\\": \\"Customer USD deposit\\",
    \\"postings\\": [
      { \\"account_id\\": \\"$CASH_ID\\",   \\"direction\\": \\"DEBIT\\",  \\"amount\\": { \\"asset\\": \\"USD\\", \\"amount\\": \\"10000\\" } },
      { \\"account_id\\": \\"$WALLET_ID\\", \\"direction\\": \\"CREDIT\\", \\"amount\\": { \\"asset\\": \\"USD\\", \\"amount\\": \\"9700\\" } },
      { \\"account_id\\": \\"$FEES_ID\\",   \\"direction\\": \\"CREDIT\\", \\"amount\\": { \\"asset\\": \\"USD\\", \\"amount\\": \\"300\\" } }
    ]
  }" | grep -i "x-idempotent-replay\\|HTTP"`;

const RESP_REPLAY = `HTTP/2 200
x-idempotent-replay: true`;

// ---- Official SDKs (same flow, 5 lines each) ------------------------------

const SDK_TS = `import { LedgerCore, Money } from "@ledgercore/sdk";

const lc = new LedgerCore({ apiKey: process.env.LEDGERCORE_API_KEY, apiSecret: process.env.LEDGERCORE_API_SECRET, baseUrl: "${API}" });
const ledger = await lc.ledgers.create({ name: "main" });
const wallet = await lc.accounts.create({ ledger_id: ledger.id, name: "customer:42:wallet", type: "liability", normal_balance: "CREDIT" });
const txn = await lc.transactions.create({ ledger_id: ledger.id, postings: [/* debits = credits, Money.fromDecimal("100.50","USD",2) */] });`;

const SDK_PHP = `use LedgerCore\\LedgerCore;
use LedgerCore\\Money;

$lc = new LedgerCore(['api_key' => getenv('LEDGERCORE_API_KEY'), 'api_secret' => getenv('LEDGERCORE_API_SECRET'), 'base_url' => '${API}']);
$ledger = $lc->ledgers->create(['name' => 'main']);
$txn = $lc->transactions->create(['ledger_id' => $ledger['id'], 'postings' => [/* Money::fromDecimal('100.50','USD',2) */]]);`;

// ---- i18n -----------------------------------------------------------------

interface StepCopy {
  title: string;
  body: string;
  curlLabel: string;
  respLabel: string;
}

interface QuickstartCopy {
  metaBadge: string;
  title: string;
  subtitle: string;
  signupCta: string;
  steps: StepCopy[];
  sdksTitle: string;
  sdksBody: string;
  sdkTsLabel: string;
  sdkPhpLabel: string;
  errorsTitle: string;
  errors: Array<{ code: string; body: string }>;
  finalTitle: string;
  finalBody: string;
  finalCta: string;
  consoleCta: string;
  copy: string;
  copied: string;
}

const ES: QuickstartCopy = {
  metaBadge: "Quickstart · 10 minutos",
  title: "De 0 a tu primera transacción",
  subtitle:
    "Siete pasos con comandos reales contra el sandbox: crea tu tenant, postea un depósito de doble partida y comprueba que el ledger balancea — con idempotencia demostrada al final.",
  signupCta: "1 · Crea tu sandbox",
  steps: [
    {
      title: "Crea tu credencial API",
      body: "Regístrate en el sandbox gratuito (dura 14 días), acepta la invitación para fijar tu contraseña y entra a la consola. En Developers → API credentials pulsa Create credential, marca los scopes ledger:read y ledger:write y copia api_key (ak_sandbox_…) y api_secret (as_sandbox_…). El secreto se muestra una sola vez: guárdalo en un gestor de secretos.",
      curlLabel: "",
      respLabel: "",
    },
    {
      title: "Firma tus requests",
      body: "Cada request lleva X-Api-Key, X-Timestamp, X-Nonce y X-Signature (HMAC-SHA256 con tu secreto; ±300 s; nonce de un solo uso). La función lc firma y envía con curl y openssl (necesitas también jq); los SDKs lo hacen solos. Los detalles y los errores están en la guía de autenticación. Las llaves lk_ antiguas y POST /v1/auth/token siguen funcionando hasta el 2027-02-01, pero están obsoletas.",
      curlLabel: "bash · lc (curl + openssl)",
      respLabel: "Respuesta esperada (tenant nuevo)",
    },
    {
      title: "Crea tu primer ledger",
      body: "Un ledger es un libro contable aislado dentro de tu tenant, con su propio plan de cuentas.",
      curlLabel: "POST /v1/ledgers",
      respLabel: "Respuesta esperada (201)",
    },
    {
      title: "Crea las tres cuentas",
      body: "El patrón mínimo de un depósito: caja (activo, saldo normal DEBIT), el wallet del cliente (pasivo, CREDIT) y los ingresos por comisión (revenue, CREDIT).",
      curlLabel: "POST /v1/accounts × 3",
      respLabel: "Respuesta esperada por cuenta (201)",
    },
    {
      title: "Postea el depósito 100 / 97 / 3",
      body: "Un depósito de $100.00 USD: 10000 centavos salen de caja (débito), 9700 acreditan al wallet y 300 a comisiones. Los montos son enteros en unidades menores, string-encoded — nunca floats. Si no balancea por asset, la API responde 409/422 y no postea nada.",
      curlLabel: "POST /v1/transactions",
      respLabel: "Respuesta esperada (201, status posted)",
    },
    {
      title: "Verifica balances y trial balance",
      body: "El wallet debe mostrar 9700 disponibles y el trial balance debe cerrar: débitos = créditos por asset, verificado por el motor.",
      curlLabel: "GET balances + trial balance",
      respLabel: "Respuesta esperada",
    },
    {
      title: "Repite el curl: replay idempotente",
      body: "Ejecuta el MISMO comando del paso 5 otra vez (lc firma de nuevo, con nonce y timestamp nuevos). No se duplica dinero: la API devuelve la transacción original con 200 y la cabecera X-Idempotent-Replay: true. Esa es la garantía que hace seguros los retries.",
      curlLabel: "El mismo POST, segunda vez",
      respLabel: "Cabeceras esperadas",
    },
  ],
  sdksTitle: "Lo mismo con los SDKs oficiales",
  sdksBody:
    "Todo el flujo anterior en 5 líneas: los SDKs de TypeScript (@ledgercore/sdk) y PHP (ledgercore/sdk) firman cada request por ti con tu llave y tu secreto, generan la idempotency key si no la pasas y manejan el dinero siempre como strings de unidades menores (Money.fromDecimal). Viven en sdks/ dentro del monorepo.",
  sdkTsLabel: "TypeScript · npm install @ledgercore/sdk",
  sdkPhpLabel: "PHP · composer require ledgercore/sdk",
  errorsTitle: "Errores comunes",
  errors: [
    {
      code: "401 signature_invalid",
      body: "La firma no coincide: el HOST debe ser el de la URL, el cuerpo y la query no pueden cambiar después de firmar y la llave y el secreto deben ser de la misma credencial. timestamp_skew: sincroniza el reloj (±300 s). nonce_reused: cada intento lleva un nonce nuevo (lc ya lo hace). credential_expired / credential_revoked: rota o crea otra credencial.",
    },
    {
      code: "409 / 422",
      body: "unbalanced_transaction: los débitos no igualan los créditos por asset — revisa los montos. conflict: ya existe un recurso con ese nombre (p. ej. el ledger “main”) o la idempotency key pertenece a otra transacción con distinto contenido.",
    },
    {
      code: "429 rate_limited",
      body: "El sandbox tiene límites de tasa. Espera unos segundos y reintenta; con la misma idempotency key el retry es seguro.",
    },
  ],
  finalTitle: "Listo: tu ledger balancea",
  finalBody:
    "Ya tienes tenant, ledger, cuentas, una transacción posteada y la prueba de idempotencia. Entra a la consola con tu correo y contraseña para ver todo esto en vivo.",
  finalCta: "Crear mi sandbox",
  consoleCta: "Entrar a la consola",
  copy: "Copiar",
  copied: "Copiado",
};

const EN: QuickstartCopy = {
  metaBadge: "Quickstart · 10 minutes",
  title: "From 0 to your first transaction",
  subtitle:
    "Seven steps with real commands against the sandbox: create your tenant, post a double-entry deposit and verify the ledger balances — with idempotency proven at the end.",
  signupCta: "1 · Create your sandbox",
  steps: [
    {
      title: "Create your API credential",
      body: "Sign up for the free sandbox (it lasts 14 days), accept the invitation to set your password and sign in to the console. Under Developers → API credentials click Create credential, tick the ledger:read and ledger:write scopes and copy the api_key (ak_sandbox_…) and the api_secret (as_sandbox_…). The secret is shown exactly once: keep it in a secret manager.",
      curlLabel: "",
      respLabel: "",
    },
    {
      title: "Sign your requests",
      body: "Every request carries X-Api-Key, X-Timestamp, X-Nonce and X-Signature (HMAC-SHA256 with your secret; ±300 s; one-use nonce). The lc function signs and sends with curl and openssl (you also need jq); the SDKs do it for you. Details and errors are in the authentication guide. The old lk_ keys and POST /v1/auth/token keep working until 2027-02-01 but are deprecated.",
      curlLabel: "bash · lc (curl + openssl)",
      respLabel: "Expected response (new tenant)",
    },
    {
      title: "Create your first ledger",
      body: "A ledger is an isolated book within your tenant, with its own chart of accounts.",
      curlLabel: "POST /v1/ledgers",
      respLabel: "Expected response (201)",
    },
    {
      title: "Create the three accounts",
      body: "The minimal deposit pattern: cash (asset, normal balance DEBIT), the customer wallet (liability, CREDIT) and fee revenue (revenue, CREDIT).",
      curlLabel: "POST /v1/accounts × 3",
      respLabel: "Expected response per account (201)",
    },
    {
      title: "Post the 100 / 97 / 3 deposit",
      body: "A $100.00 USD deposit: 10000 cents leave cash (debit), 9700 credit the wallet and 300 go to fees. Amounts are integers in minor units, string-encoded — never floats. If it doesn't balance per asset, the API answers 409/422 and posts nothing.",
      curlLabel: "POST /v1/transactions",
      respLabel: "Expected response (201, status posted)",
    },
    {
      title: "Verify balances and the trial balance",
      body: "The wallet must show 9700 available and the trial balance must close: debits = credits per asset, enforced by the engine.",
      curlLabel: "GET balances + trial balance",
      respLabel: "Expected response",
    },
    {
      title: "Run the curl again: idempotent replay",
      body: "Run the SAME command from step 5 once more (lc signs again, with a new nonce and timestamp). No money is duplicated: the API returns the original transaction with 200 and the X-Idempotent-Replay: true header. That guarantee is what makes retries safe.",
      curlLabel: "The same POST, second time",
      respLabel: "Expected headers",
    },
  ],
  sdksTitle: "The same flow with the official SDKs",
  sdksBody:
    "The whole flow above in 5 lines: the TypeScript (@ledgercore/sdk) and PHP (ledgercore/sdk) SDKs sign every request for you with your key and secret, generate the idempotency key when you don't pass one, and always treat money as minor-unit strings (Money.fromDecimal). They live under sdks/ in the monorepo.",
  sdkTsLabel: "TypeScript · npm install @ledgercore/sdk",
  sdkPhpLabel: "PHP · composer require ledgercore/sdk",
  errorsTitle: "Common errors",
  errors: [
    {
      code: "401 signature_invalid",
      body: "The signature does not match: HOST must be the one in the URL, the body and query cannot change after signing, and the key and secret must belong to the same credential. timestamp_skew: sync your clock (±300 s). nonce_reused: every attempt carries a new nonce (lc already does that). credential_expired / credential_revoked: rotate it or create another credential.",
    },
    {
      code: "409 / 422",
      body: "unbalanced_transaction: debits don't equal credits per asset — check the amounts. conflict: a resource with that name already exists (e.g. the “main” ledger) or the idempotency key belongs to another transaction with different content.",
    },
    {
      code: "429 rate_limited",
      body: "The sandbox is rate limited. Wait a few seconds and retry; with the same idempotency key the retry is safe.",
    },
  ],
  finalTitle: "Done: your ledger balances",
  finalBody:
    "You now have a tenant, a ledger, accounts, a posted transaction and proof of idempotency. Sign in to the console with your email and password to see it all live.",
  finalCta: "Create my sandbox",
  consoleCta: "Open the console",
  copy: "Copy",
  copied: "Copied",
};

const COPY: Record<Lang, QuickstartCopy> = { es: ES, en: EN };

// ---- UI -------------------------------------------------------------------

function CodeBlock({
  label,
  code,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-x-auto rounded-lg border border-edge bg-[#04070c] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-wider text-ink-faint uppercase">
          <Terminal size={12} aria-hidden="true" />
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 rounded-md border border-edge-strong px-2 py-1 text-[11px] font-medium text-ink-muted hover:text-accent"
        >
          {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <pre className="font-mono text-xs leading-relaxed whitespace-pre text-ink-muted">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ResponseBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-edge bg-surface-raised/60 p-4">
      <p className="mb-2 text-[11px] font-medium tracking-wider text-ink-faint uppercase">
        {label}
      </p>
      <pre className="font-mono text-xs leading-relaxed whitespace-pre text-accent/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Step({
  index,
  copy,
  children,
}: {
  index: number;
  copy: StepCopy;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative pl-12">
      <span
        className="absolute top-0 left-0 flex size-8 items-center justify-center rounded-full border border-accent/40 bg-accent-soft font-mono text-sm font-semibold text-accent"
        aria-hidden="true"
      >
        {index}
      </span>
      <h2 className="text-base font-semibold text-ink">{copy.title}</h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
        {copy.body}
      </p>
      {children && <div className="mt-4 space-y-3">{children}</div>}
    </section>
  );
}

function QuickstartContent() {
  const { lang } = useLang();
  const c = COPY[lang];

  const [firstStep, ...restSteps] = c.steps;
  const curls: Array<[string, string] | null> = [
    null,
    [lang === "es" ? CURL_SIGN_ES : CURL_SIGN_EN, RESP_SIGN],
    [CURL_LEDGER, RESP_LEDGER],
    [CURL_ACCOUNTS, RESP_ACCOUNTS],
    [CURL_DEPOSIT, RESP_DEPOSIT],
    [CURL_BALANCES, RESP_BALANCES],
    [CURL_REPLAY, RESP_REPLAY],
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" aria-label="LedgerCore">
          <BrandLockup size={30} />
        </Link>
        <div className="flex items-center gap-3">
          <LangToggle />
          <Link
            href="/signup"
            className="rounded-(--radius-control) border border-edge-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent"
          >
            {c.finalCta}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-24">
        <Badge tone="emerald" className="mb-4">
          {c.metaBadge}
        </Badge>
        <h1 className="max-w-2xl font-serif text-[34px] leading-tight tracking-[-0.01em] text-ink">
          {c.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {c.subtitle}
        </p>

        <div className="mt-12 space-y-12">
          {firstStep && (
          <Step index={1} copy={firstStep}>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-accent-deep px-5 text-sm font-semibold text-[#03150e] shadow-[0_0_24px_rgb(16_185_129/0.3)] transition-colors hover:bg-accent"
            >
              {c.signupCta}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Step>
          )}

          {restSteps.map((step, i) => {
            const pair = curls[i + 1];
            return (
              <Step key={step.title} index={i + 2} copy={step}>
                {pair && (
                  <>
                    <CodeBlock
                      label={step.curlLabel}
                      code={pair[0]}
                      copyLabel={c.copy}
                      copiedLabel={c.copied}
                    />
                    <ResponseBlock label={step.respLabel} code={pair[1]} />
                  </>
                )}
              </Step>
            );
          })}
        </div>

        <section className="mt-16">
          <h2 className="text-base font-semibold text-ink">{c.sdksTitle}</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {c.sdksBody}
          </p>
          <div className="mt-4 space-y-3">
            <CodeBlock
              label={c.sdkTsLabel}
              code={SDK_TS}
              copyLabel={c.copy}
              copiedLabel={c.copied}
            />
            <CodeBlock
              label={c.sdkPhpLabel}
              code={SDK_PHP}
              copyLabel={c.copy}
              copiedLabel={c.copied}
            />
          </div>
        </section>

        <section className="mt-16 rounded-(--radius-card) border border-edge bg-surface/70 p-6">
          <h2 className="text-base font-semibold text-ink">{c.errorsTitle}</h2>
          <ul className="mt-4 space-y-4">
            {c.errors.map((err) => (
              <li key={err.code} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                <code className="shrink-0 font-mono text-xs font-semibold text-warning sm:w-40">
                  {err.code}
                </code>
                <p className="text-sm text-ink-muted">{err.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 text-center">
          <h2 className="text-xl font-semibold text-ink">{c.finalTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            {c.finalBody}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-accent-deep px-5 text-sm font-semibold text-[#03150e] transition-colors hover:bg-accent"
            >
              {c.finalCta}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) border border-edge-strong px-5 text-sm font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent"
            >
              {c.consoleCta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-edge px-6 py-6 text-center">
        <p className="text-[11px] tracking-wide text-ink-faint">
          LedgerCore — {lang === "es" ? "infraestructura financiera" : "financial infrastructure"}
        </p>
      </footer>
    </div>
  );
}

export function QuickstartView() {
  return (
    <LanguageProvider>
      <QuickstartContent />
    </LanguageProvider>
  );
}
