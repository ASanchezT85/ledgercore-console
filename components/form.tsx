// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/** Small form pieces shared by the console's write flows. */

import type { ReactNode } from "react";

export const inputClass =
  "h-9 w-full rounded-(--radius-control) border border-edge-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1 text-xs text-ink-faint ${className}`}>
      {label}
      {children}
    </label>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 text-xs text-danger">
      {message}
    </p>
  );
}

export function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-(--radius-control) border border-accent/30 bg-accent-soft px-4 py-2 text-sm text-ink"
    >
      {message}
    </p>
  );
}

/** "a, b ,c" -> ["a","b","c"]; empty input -> []. */
export function splitList(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
