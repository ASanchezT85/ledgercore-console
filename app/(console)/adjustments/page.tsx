// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { AdjustmentsView } from "./adjustments-view";

export const metadata: Metadata = {
  title: "Adjustments",
};

export default function AdjustmentsPage() {
  return <AdjustmentsView />;
}
