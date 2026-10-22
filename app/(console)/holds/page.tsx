// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { HoldsView } from "./holds-view";

export const metadata: Metadata = {
  title: "Holds",
};

export default function HoldsPage() {
  return <HoldsView />;
}
