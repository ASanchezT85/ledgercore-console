// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { BrandLockup } from "@/components/logo";
import { LanguageProvider, useLang } from "@/components/language";
import { PublicHeader } from "@/components/public-header";

function Shell({ children }: { children: ReactNode }) {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader hideLogin showHome />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <BrandLockup size={40} />
            <p className="text-sm text-ink-faint">{t.login.tagline}</p>
          </div>
          {children}
          <p className="mt-6 text-center text-[11px] text-ink-faint">
            {t.footer.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Page frame shared by the public authentication screens. */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <Shell>{children}</Shell>
    </LanguageProvider>
  );
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-(--radius-card) border border-edge bg-surface/80 p-6 shadow-[0_1px_0_rgb(255_255_255/0.04)_inset,0_16px_48px_rgb(2_6_12/0.6)] backdrop-blur-md">
      <h1 className="mb-5 text-sm font-semibold text-ink">{title}</h1>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>
      <span className="flex items-center gap-2 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 py-2.5 focus-within:border-accent/60">
        {children}
      </span>
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputClass = "w-full bg-transparent text-sm text-ink placeholder:text-ink-faint";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-ink">
      {children}
    </p>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-ink">
      {children}
    </p>
  );
}

export function SubmitButton({
  busy,
  disabled,
  label,
  busyLabel,
}: {
  busy: boolean;
  disabled?: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-(--radius-control) bg-accent-deep text-sm font-semibold text-[#03150e] shadow-[0_0_24px_rgb(16_185_129/0.3)] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && <ThinkingOrb state="listening" size={20} theme="light" aria-hidden="true" />}
      {busy ? busyLabel : label}
      {!busy && <ArrowRight size={15} aria-hidden="true" />}
    </button>
  );
}
