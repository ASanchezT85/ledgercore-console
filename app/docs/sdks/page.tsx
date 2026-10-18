// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { SdksView } from "./sdks-view";

export const metadata: Metadata = {
  title: "SDKs — LedgerCore Docs",
  description:
    "SDKs oficiales de LedgerCore: TypeScript (@ledgercore/sdk en npm) y PHP (ledgercore/sdk en Packagist). Instalación, quickstart de 5 líneas y enlaces al código.",
};

export default function Page() {
  return <SdksView />;
}
