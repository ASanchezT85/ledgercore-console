// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { Metadata } from "next";
import { OnboardingView } from "./onboarding-view";

export const metadata: Metadata = {
  title: "Activa tu cuenta",
};

export default function OnboardingPage() {
  return <OnboardingView />;
}
