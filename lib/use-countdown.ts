// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Seconds left of a cooldown (the 60 s between two verification codes).
 * `start(n)` begins it; the server enforces the real limit, this only keeps
 * the button from inviting a click that would be refused.
 */
export function useCountdown(): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  const start = useCallback((seconds: number) => setLeft(seconds), []);
  return [left, start];
}
