// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LangToggle, useLang } from "@/components/language";
import { BrandLockup } from "@/components/logo";
import { logout } from "@/lib/session";

/**
 * Header of the signed-in pages that live outside the console frame (the
 * activation wizard and the back office): the logo goes home, the language can
 * be switched, and the session can be ended from every screen.
 */
export function SessionHeader() {
  const router = useRouter();
  const { t } = useLang();
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
      <Link href="/" aria-label={t.nav.homeAriaLabel}>
        <BrandLockup size={30} />
      </Link>
      <nav className="flex items-center gap-2" aria-label={t.nav.ariaLabel}>
        <LangToggle />
        <Link href="/" className="hidden h-11 items-center rounded-(--radius-control) px-4 text-sm text-ink-muted transition-colors hover:text-ink sm:inline-flex">
          {t.nav.home}
        </Link>
        <button
          type="button"
          onClick={() => {
            void logout();
            router.replace("/login");
          }}
          className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) border border-edge-strong px-4 text-sm text-ink transition-colors hover:border-danger/60 hover:text-danger"
        >
          <LogOut size={14} aria-hidden="true" />
          {t.onboarding.signOut}
        </button>
      </nav>
    </header>
  );
}
