// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";

/**
 * A QR code drawn in the browser (uqr, no network): the otpauth:// URI carries
 * the TOTP secret, so it must never be sent to an image service. White quiet
 * zone on purpose: authenticator apps need dark-on-light contrast in dark mode too.
 */
export function QrCode({ text, alt, size = 176 }: { text: string; alt: string; size?: number }) {
  const src = useMemo(
    () =>
      `data:image/svg+xml;utf8,${encodeURIComponent(
        renderSVG(text, { border: 2, blackColor: "#0b1020", whiteColor: "#ffffff" }),
      )}`,
    [text],
  );
  // eslint-disable-next-line @next/next/no-img-element -- an inline data: SVG, nothing to optimize
  return <img src={src} alt={alt} width={size} height={size} className="rounded-lg bg-white" />;
}
