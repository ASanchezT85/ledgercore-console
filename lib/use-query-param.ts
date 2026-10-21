// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useEffect, useState } from "react";

/**
 * A query-string value read after mount. `undefined` until then, `null` when
 * the parameter is absent.
 *
 * Used instead of useSearchParams on the auth pages: that hook forces a
 * Suspense boundary, and a boundary hydrates lazily, after LanguageProvider has
 * already switched from the SSR language to the visitor's, which logs a
 * hydration mismatch on every load.
 */
export function useQueryParam(name: string): string | null | undefined {
  const [value, setValue] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}
