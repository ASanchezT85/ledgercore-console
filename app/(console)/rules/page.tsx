// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { RulesView } from "./rules-view";

export const metadata: Metadata = {
  title: "Posting rules",
};

export default function RulesPage() {
  return <RulesView />;
}
