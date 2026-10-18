// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { LedgersView } from "./ledgers-view";

export const metadata: Metadata = {
  title: "Ledgers",
};

export default function LedgersPage() {
  return <LedgersView />;
}
