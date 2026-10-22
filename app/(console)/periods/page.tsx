// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { PeriodsView } from "./periods-view";

export const metadata: Metadata = {
  title: "Periods",
};

export default function PeriodsPage() {
  return <PeriodsView />;
}
