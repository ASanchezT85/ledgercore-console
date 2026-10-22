// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { AuditView } from "./audit-view";

export const metadata: Metadata = {
  title: "Audit log",
};

export default function AuditPage() {
  return <AuditView />;
}
