// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { ShieldCheck } from "lucide-react";
import { Field, inputClass } from "@/components/auth-shell";

/** A six-digit one-time code field (email, SMS). Digits only; the browser may offer the SMS code. */
export function CodeInput({
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Field label={label}>
      <ShieldCheck size={14} className="shrink-0 text-ink-faint" aria-hidden="true" />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={8}
        required
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`${inputClass} font-mono tracking-[0.4em]`}
        placeholder="000000"
        autoFocus={autoFocus}
      />
    </Field>
  );
}
