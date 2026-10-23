// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

/**
 * LedgerCore logomark ("Contrapartida", 7.13): a debit arrow in and a credit
 * arrow out that together read as an equals sign. Colors come from the theme
 * tokens, so the mark follows light and dark mode.
 */
export function Logomark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 10h20M20 5l5 5-5 5" stroke="var(--color-debit)" />
        <path d="M27 22H7M12 17l-5 5 5 5" stroke="var(--color-credit)" />
      </g>
    </svg>
  );
}

export function BrandLockup({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logomark size={size} />
      <span className="font-serif text-lg tracking-tight text-ink">ledgercore</span>
    </span>
  );
}
