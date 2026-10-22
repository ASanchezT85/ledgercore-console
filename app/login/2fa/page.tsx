// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { TwoFactorView } from "./two-factor-view";

export const metadata: Metadata = {
  title: "Verificación en dos pasos",
};

export default function TwoFactorPage() {
  return <TwoFactorView />;
}
