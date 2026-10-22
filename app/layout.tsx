// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["ui-monospace", "Cascadia Code", "Menlo", "monospace"],
});

/** Display face for headings and the wordmark. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

/**
 * Applies the saved theme before first paint so a dark-mode user never sees a
 * light flash. Light is the default; only an explicit choice switches it.
 */
const THEME_INIT = `try{if(localStorage.getItem("lc-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export const metadata: Metadata = {
  title: {
    default: "LedgerCore Console",
    template: "%s · LedgerCore Console",
  },
  description:
    "LedgerCore operations console: ledgers, transactions, reconciliation and developer tools.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
