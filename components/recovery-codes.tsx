// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The one-time list of recovery codes with a copy button. The codes live only
 * in this component's props: they are never written to storage or the URL.
 */
export function RecoveryCodes({
  codes,
  copyLabel,
  copiedLabel,
}: {
  codes: string[];
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked: the codes are on screen, select them by hand */
    }
  }

  return (
    <div>
      <ul
        className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-edge-strong bg-surface-raised p-3 font-mono text-sm text-ink"
        aria-label="Recovery codes"
      >
        {codes.map((c) => (
          <li key={c} className="select-all">
            {c}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
