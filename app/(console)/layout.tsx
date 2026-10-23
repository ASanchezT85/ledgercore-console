// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { ReactNode } from "react";
import { AccountGate } from "@/components/account-gate";
import { AuthorCredit } from "@/components/author-credit";
import { StepUpDialog } from "@/components/step-up-dialog";
import { Sidebar } from "@/components/ui/sidebar";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-col pl-64">
        <main className="mx-auto w-full max-w-7xl flex-1 px-8 py-8">
          <AccountGate />
          <StepUpDialog />
          {children}
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-8 py-4">
          <p className="text-[11px] tracking-wide text-ink-faint">
            LedgerCore — financial infrastructure
          </p>
          <AuthorCredit />
        </footer>
      </div>
    </div>
  );
}
