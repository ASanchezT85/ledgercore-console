// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { TransactionsView } from "./transactions-view";

export const metadata: Metadata = {
  title: "Transacciones",
};

export default function TransactionsPage() {
  return <TransactionsView />;
}
