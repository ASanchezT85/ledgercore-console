// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

// Interactive API reference for the four OpenAPI contracts.
//
// Rendering: Scalar's standalone browser bundle, self-hosted at
// /vendor/scalar.standalone.js (copied from node_modules by
// scripts/prepare-docs-assets.mjs at prebuild). The specs are served
// same-origin from /openapi/*.v1.yaml — no external CDN involved, so the
// page works in the standalone production build without internet access.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/logo";
import { SCALAR_SRI } from "./scalar-sri";

declare global {
  interface Window {
    Scalar?: {
      createApiReference: (el: string | HTMLElement, config: unknown) => unknown;
    };
  }
}

// Scalar reads its colors from --scalar-* variables; point them at the tokens
// in app/globals.css so the reference matches the console in both themes.
const SCALAR_CSS = `
.light-mode, .dark-mode {
  --scalar-background-1: var(--color-canvas);
  --scalar-background-2: var(--color-surface);
  --scalar-background-3: var(--color-surface-raised);
  --scalar-background-accent: var(--color-accent-soft);
  --scalar-color-1: var(--color-ink);
  --scalar-color-2: var(--color-ink-muted);
  --scalar-color-3: var(--color-ink-faint);
  --scalar-color-accent: var(--color-accent);
  --scalar-border-color: var(--color-edge);
  --scalar-color-green: var(--color-debit);
  --scalar-color-blue: var(--color-info);
  --scalar-color-orange: var(--color-credit);
  --scalar-color-yellow: var(--color-warning);
  --scalar-color-red: var(--color-danger);
  --scalar-button-1: var(--color-accent);
  --scalar-button-1-color: var(--color-on-accent);
  --scalar-button-1-hover: var(--color-accent-deep);
  --scalar-font: var(--font-sans);
  --scalar-font-code: var(--font-mono);
}
.light-mode .t-doc__sidebar, .dark-mode .t-doc__sidebar {
  --scalar-sidebar-background-1: var(--color-surface);
  --scalar-sidebar-color-1: var(--color-ink);
  --scalar-sidebar-color-2: var(--color-ink-muted);
  --scalar-sidebar-border-color: var(--color-edge);
  --scalar-sidebar-item-active-background: var(--color-accent-soft);
  --scalar-sidebar-color-active: var(--color-accent);
}
`;

const SOURCES = [
  { slug: "ledger", title: "Ledger Core", url: "/openapi/ledger.v1.yaml", default: true },
  { slug: "identity", title: "Identity", url: "/openapi/identity.v1.yaml" },
  { slug: "reconciliation", title: "Reconciliation", url: "/openapi/reconciliation.v1.yaml" },
  { slug: "webhooks", title: "Webhooks", url: "/openapi/webhooks.v1.yaml" },
];

export function ApiReferenceView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const init = () => {
      if (!window.Scalar || !containerRef.current) {
        setError(true);
        return;
      }
      // The specs only list localhost servers. On a deployment, "Send" must hit
      // this same host (the gateway serves /v1 next to the console); locally the
      // console runs on :3000 apart from the gateway, so keep the spec servers.
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
      window.Scalar.createApiReference(containerRef.current, {
        sources: SOURCES,
        ...(local ? {} : { servers: [{ url: window.location.origin, description: "This deployment" }] }),
        // Self-contained: no font fetch from Scalar's CDN, no request proxy.
        withDefaultFonts: false,
        proxyUrl: "",
        // No usage telemetry leaves the page.
        telemetry: false,
        // Follows the console theme; colors come from the shared tokens (7.13).
        forceDarkModeState: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        hideDarkModeToggle: true,
        hideTestRequestButton: false,
        theme: "none",
        customCss: SCALAR_CSS,
        metaData: { title: "LedgerCore API Reference" },
      });
    };

    if (window.Scalar) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.src = "/vendor/scalar.standalone.js";
    script.async = true;
    script.integrity = SCALAR_SRI;
    script.crossOrigin = "anonymous";
    script.onload = init;
    script.onerror = () => setError(true);
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="flex w-full items-center justify-between border-b border-edge px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="LedgerCore">
            <BrandLockup size={26} />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-accent"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Docs
          </Link>
        </div>
        <span className="font-mono text-xs text-ink-faint">
          localhost:8080
        </span>
      </header>
      {error && (
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-sm text-ink-muted">
            No se pudo cargar el visor interactivo. / The interactive viewer failed to load.
          </p>
          <ul className="mt-4 space-y-1 font-mono text-xs">
            {SOURCES.map((s) => (
              <li key={s.slug}>
                <a className="text-accent hover:underline" href={s.url}>
                  {s.title} — {s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
