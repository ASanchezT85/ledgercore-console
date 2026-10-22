// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { GuideView } from "../../docs-ui";
import { GUIDE } from "./content";

export const metadata: Metadata = {
  title: "Estados — LedgerCore Docs",
  description:
    "El ciclo de vida de transacciones, cuentas, holds, movimientos, periodos, ajustes y entregas de webhook: qué estados existen y qué transiciones permite la API.",
};

export default function Page() {
  return <GuideView content={GUIDE} />;
}
