// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { TransfersView } from "./transfers-view";

export const metadata: Metadata = {
  title: "FX and transfers",
};

export default function TransfersPage() {
  return <TransfersView />;
}
