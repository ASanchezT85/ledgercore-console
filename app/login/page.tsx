// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { LoginView } from "./login-view";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return <LoginView />;
}
