// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { hasSession } from "@/lib/session";
import { ReconLive } from "./recon-live";

/** The real reconciliation screen with a session; the demo page (children) without one. */
export function ReconSwitch({ children }: { children: ReactNode }) {
  // Read after mount so server and client render the same first frame.
  const [live, setLive] = useState(false);
  useEffect(() => setLive(hasSession()), []);
  return live ? <ReconLive /> : <>{children}</>;
}
