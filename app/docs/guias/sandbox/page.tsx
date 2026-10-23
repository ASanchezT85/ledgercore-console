// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { GuideView } from "../../docs-ui";
import { GUIDE } from "./content";

export const metadata: Metadata = {
  title: "Sandbox — LedgerCore Docs",
  description:
    "Cómo obtener un sandbox, qué comparte con producción, sus límites y cómo se pasa a producción.",
};

export default function Page() {
  return <GuideView content={GUIDE} />;
}
