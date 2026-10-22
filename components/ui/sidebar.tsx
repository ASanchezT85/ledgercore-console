// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpenText,
  Code2,
  LayoutDashboard,
  Landmark,
  LockKeyhole,
  LogOut,
  Route,
  Scale,
  Users,
} from "lucide-react";
import { BrandLockup } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import {
  getSessionInfo,
  hasSession,
  logout,
  type SessionInfo,
} from "@/lib/session";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ledgers", label: "Ledgers", icon: BookOpenText },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/holds", label: "Holds", icon: LockKeyhole },
  { href: "/movements", label: "Movements", icon: Route },
  { href: "/providers", label: "Providers", icon: Landmark },
  { href: "/reconciliation", label: "Reconciliation", icon: Scale },
  { href: "/developers", label: "Developers", icon: Code2 },
  { href: "/users", label: "Users", icon: Users },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [info, setInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    if (!hasSession()) return;
    setLive(true);
    void getSessionInfo().then(setInfo);
  }, []);

  // Roles that cannot manage users do not get the entry (demo mode keeps it).
  const canManageUsers = !live || info?.user.role === "owner" || info?.user.role === "admin";
  const navItems = NAV_ITEMS.filter((i) => i.href !== "/users" || canManageUsers || !info);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-edge bg-surface/60 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link href="/dashboard" aria-label="LedgerCore — dashboard">
          <BrandLockup />
        </Link>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center justify-between rounded-lg border border-edge bg-surface-raised px-3 py-2">
          <div className="min-w-0">
            {live ? (
              <>
                <p
                  className="truncate text-xs font-medium text-ink"
                  title={info?.tenant.id}
                >
                  {info?.tenant.name ?? "tenant"}
                </p>
                <p className="text-[10px] text-ink-faint">tenant · signed in</p>
              </>
            ) : (
              <>
                <p className="truncate text-xs font-medium text-ink">
                  Acme Fintech, Inc.
                </p>
                <p className="text-[10px] text-ink-faint">tenant · demo</p>
              </>
            )}
          </div>
          <Badge
            tone={live ? (info?.environment === "live" ? "emerald" : "violet") : "slate"}
            dot
          >
            {live ? (info?.environment ?? "…") : "demo"}
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <Icon
                size={17}
                strokeWidth={2}
                className={active ? "text-accent" : "text-ink-faint group-hover:text-ink-muted"}
                aria-hidden="true"
              />
              {label}
              {active && (
                <span
                  className="ml-auto h-4 w-0.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-edge px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-xs font-semibold text-accent">
            {live ? (info?.user.email.slice(0, 2).toUpperCase() ?? "…") : "MF"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">
              {live ? (info?.user.email ?? "…") : "María Fernández"}
            </p>
            <p className="truncate text-[10px] text-ink-faint">
              {live ? (info?.user.role ?? "…") : "finance-ops@acme.com"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void logout();
              router.push("/login");
            }}
            className="text-ink-faint transition-colors hover:text-danger"
            aria-label="Sign out"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
