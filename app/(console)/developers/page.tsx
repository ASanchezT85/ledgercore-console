// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { DevelopersView } from "./developers-view";

export const metadata: Metadata = {
  title: "Developers",
};

export default function DevelopersPage() {
  return <DevelopersView />;
}
