// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { WebhooksView } from "./webhooks-view";

export const metadata: Metadata = {
  title: "Webhooks",
};

export default function WebhooksPage() {
  return <WebhooksView />;
}
