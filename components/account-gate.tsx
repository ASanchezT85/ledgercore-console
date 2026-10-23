// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, ShieldAlert } from "lucide-react";
import { DICTIONARIES, detectLang, type Lang } from "@/lib/i18n";
import { PRE_SANDBOX, type AccountStatus } from "@/lib/onboarding";
import { getSessionInfo, hasSession } from "@/lib/session";

/**
 * Sends a signed-in person whose account has not finished the verification
 * steps to the activation wizard, and reminds the others — sandbox, under
 * review, rejected — where their account stands. Demo mode (no session) and
 * approved accounts see nothing.
 */
export function AccountGate() {
  const router = useRouter();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    if (!hasSession()) return;
    setLang(detectLang());
    void getSessionInfo().then((info) => {
      const st = info?.account_status as AccountStatus | undefined;
      if (!info || !st) return;
      // LedgerCore staff have no ledger to look at: their desk is the back office.
      if (info.user.role === "platform_operator") {
        router.replace("/backoffice");
        return;
      }
      if (PRE_SANDBOX.includes(st)) router.replace("/onboarding");
      else setStatus(st);
    });
  }, [router]);

  if (status !== "sandbox" && status !== "under_review" && status !== "rejected") return null;
  const b = DICTIONARIES[lang].onboarding.banner;
  const Icon = status === "rejected" ? ShieldAlert : Clock;
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge-strong bg-surface-raised px-4 py-3 text-xs text-ink"
    >
      <span className="flex items-center gap-2">
        <Icon size={15} className={status === "rejected" ? "text-danger" : "text-info"} aria-hidden="true" />
        {b[status]}
      </span>
      <Link href="/onboarding" className="font-medium text-accent hover:underline">
        {b.link}
      </Link>
    </div>
  );
}
