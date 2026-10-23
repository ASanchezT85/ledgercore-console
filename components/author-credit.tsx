// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Lang } from "@/lib/i18n";

// Authorship credit shown in every footer (console, landing and /docs).
// Keep in sync with NOTICE.
export const AUTHOR_NAME = "Alexander J. Sánchez T.";
export const AUTHOR_URL = "https://alexander.sanchezavila.com";

const LABEL: Record<Lang, string> = {
  es: "Diseñado y construido por",
  en: "Designed and built by",
};

export function AuthorCredit({ lang = "en" }: { lang?: Lang }) {
  return (
    <p className="text-[11px] tracking-wide text-ink-faint">
      {LABEL[lang]}{" "}
      <a
        href={AUTHOR_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
      >
        {AUTHOR_NAME}
      </a>
    </p>
  );
}
