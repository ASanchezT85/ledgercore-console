// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { MovementsView } from "./movements-view";

export const metadata: Metadata = {
  title: "Movements",
};

export default function MovementsPage() {
  return <MovementsView />;
}
