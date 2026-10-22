// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Light by default; the choice persists in localStorage (see THEME_INIT in app/layout.tsx). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("lc-theme", next ? "dark" : "light");
    } catch {}
    window.dispatchEvent(new Event("lc-theme"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`inline-flex size-9 items-center justify-center rounded-(--radius-control) text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink ${className}`}
    >
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}
