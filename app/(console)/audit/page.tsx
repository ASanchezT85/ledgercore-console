// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { AuditView } from "./audit-view";

export const metadata: Metadata = {
  title: "Audit log",
};

export default function AuditPage() {
  return <AuditView />;
}
