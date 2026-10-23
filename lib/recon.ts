// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/** Reconciliation service calls (contracts/openapi/reconciliation.v1.yaml), same session token as the ledger. */

import { apiFetch, queryString } from "./live";

interface Page<T> {
  data: T[];
  next_cursor?: string | null;
}

export type SourceKind = "bank" | "psp" | "provider" | "manual";

export interface ReconSource {
  id: string;
  name: string;
  kind: SourceKind;
  created_at: string;
}

export interface ReconRun {
  id: string;
  source_id: string;
  rule_version: number;
  status: "pending" | "running" | "completed" | "failed";
  matched_count: number;
  unmatched_count: number;
  started_at: string;
  finished_at: string | null;
}

export type DiscrepancyStatus = "open" | "investigating" | "resolved";
export type Severity = "low" | "medium" | "high" | "critical";

export interface ReconDiscrepancy {
  id: string;
  source_id: string;
  run_id: string | null;
  kind: string;
  details: Record<string, unknown>;
  status: DiscrepancyStatus;
  severity: Severity;
  owner: string | null;
  due_at: string;
  resolved_at: string | null;
  age_seconds: number;
  sla_breached: boolean;
  created_at: string;
}

export interface ReconReport {
  data: Array<{
    source_id: string;
    source_name: string;
    matched: number;
    unmatched: number;
    disputed: number;
    open_discrepancies: number;
    overdue_discrepancies: number;
  }>;
  totals: {
    matched: number;
    unmatched: number;
    disputed: number;
    open_discrepancies: number;
    overdue_discrepancies: number;
  };
}

const base = "/v1/reconciliation";

export const listSources = (): Promise<Page<ReconSource>> =>
  apiFetch(`${base}/sources?limit=200`);

export const createSource = (body: { name: string; kind: SourceKind }): Promise<ReconSource> =>
  apiFetch(`${base}/sources`, { method: "POST", body });

export const getReports = (): Promise<ReconReport> => apiFetch(`${base}/reports`);

export const createRun = (source_id: string, rule_version?: number): Promise<ReconRun> =>
  apiFetch(`${base}/runs`, {
    method: "POST",
    body: { source_id, ...(rule_version ? { rule_version } : {}) },
  });

export const listDiscrepancies = (
  filters: { status?: DiscrepancyStatus; severity?: Severity; owner?: string; overdue?: boolean },
  cursor?: string,
): Promise<Page<ReconDiscrepancy>> =>
  apiFetch(
    `${base}/discrepancies${queryString({
      status: filters.status,
      severity: filters.severity,
      owner: filters.owner,
      overdue: filters.overdue ? "true" : undefined,
      limit: 50,
      cursor,
    })}`,
  );

export const updateDiscrepancy = (
  id: string,
  body: { status?: DiscrepancyStatus; severity?: Severity; owner?: string; resolution_note?: string },
): Promise<ReconDiscrepancy> =>
  apiFetch(`${base}/discrepancies/${encodeURIComponent(id)}`, { method: "PATCH", body });

/** A CSV statement (external_ref, amount, asset, occurred_at), processed synchronously. */
export function importCsv(source_id: string, file: File): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.set("source_id", source_id);
  form.set("file", file);
  return apiFetch(`${base}/imports`, { method: "POST", body: form });
}

export const createCustodyBalance = (
  sourceId: string,
  body: { account_id: string; asset: string; as_of: string; balance: string },
): Promise<Record<string, unknown>> =>
  apiFetch(`${base}/sources/${encodeURIComponent(sourceId)}/custody-balances`, { method: "POST", body });

export const createSettlementBatch = (
  sourceId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> =>
  apiFetch(`${base}/sources/${encodeURIComponent(sourceId)}/settlement-batches`, { method: "POST", body });

export const createMatchRule = (
  sourceId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> =>
  apiFetch(`${base}/sources/${encodeURIComponent(sourceId)}/match-rules`, { method: "POST", body });

/** Lists of a source's sub-resources, shown as returned. */
export const listSourceItems = (
  sourceId: string,
  what: "match-rules" | "custody-balances" | "settlement-batches" | "callbacks",
): Promise<Page<Record<string, unknown>>> =>
  apiFetch(`${base}/sources/${encodeURIComponent(sourceId)}/${what}?limit=50`);

export const rotateCallbackSecret = (
  sourceId: string,
): Promise<{ source_id: string; secret: string; previous_expires_at: string | null }> =>
  apiFetch(`${base}/sources/${encodeURIComponent(sourceId)}/callback-secret`, { method: "POST" });
