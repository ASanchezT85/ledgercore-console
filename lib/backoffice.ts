// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * LedgerCore's back office (roadmap 7.5): the review queue and the decisions on
 * accounts. Only platform operators (LedgerCore staff) are let in by identity;
 * the console merely shows the desk to them.
 */

import { identityFetch } from "@/lib/session";
import type { AccountStatus, Onboarding } from "@/lib/onboarding";

export interface HistoryEvent {
  occurred_at: string;
  action: string;
  actor: string;
  before: { status?: string; [k: string]: unknown } | null;
  after: { status?: string; reason?: string; channel?: string; [k: string]: unknown } | null;
}

export interface ReviewAccount extends Onboarding {
  name: string;
  slug: string;
  owner_email: string;
  decided_by?: string;
  created_at: string;
  history?: HistoryEvent[];
}

export type Decision = "approve" | "reject" | "suspend" | "reinstate";

/** The decisions each status allows (mirrors identity's state machine; identity enforces it). */
export const DECISIONS_FOR: Partial<Record<AccountStatus, Decision[]>> = {
  under_review: ["approve", "reject"],
  approved: ["suspend"],
  suspended: ["reinstate"],
};

export type QueueFilter = "under_review" | "approved" | "rejected" | "suspended" | "sandbox" | "all";

export async function listAccounts(status: QueueFilter): Promise<ReviewAccount[]> {
  const res = await identityFetch<{ data: ReviewAccount[] }>("GET", `backoffice/accounts?status=${status}&limit=200`);
  return res.data;
}

export function getAccount(tenantId: string): Promise<ReviewAccount> {
  return identityFetch<ReviewAccount>("GET", `backoffice/accounts/${tenantId}`);
}

export function decide(tenantId: string, decision: Decision, reason: string): Promise<ReviewAccount> {
  return identityFetch<ReviewAccount>("POST", `backoffice/accounts/${tenantId}/decision`, { decision, reason }, { csrf: true });
}
