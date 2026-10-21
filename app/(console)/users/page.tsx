// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { Metadata } from "next";
import { UsersView } from "./users-view";

export const metadata: Metadata = {
  title: "Users",
};

export default function UsersPage() {
  return <UsersView />;
}
