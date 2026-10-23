// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { BackOfficeView } from "./backoffice-view";

export const metadata: Metadata = {
  title: "Back office",
};

export default function BackOfficePage() {
  return <BackOfficeView />;
}
