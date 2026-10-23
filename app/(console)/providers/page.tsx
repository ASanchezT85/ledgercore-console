// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { ProvidersView } from "./providers-view";

export const metadata: Metadata = {
  title: "Providers",
};

export default function ProvidersPage() {
  return <ProvidersView />;
}
