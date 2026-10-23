// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { VerifyEmailView } from "./verify-view";

export const metadata: Metadata = {
  title: "Verificar correo",
};

export default function VerifyEmailPage() {
  return <VerifyEmailView />;
}
