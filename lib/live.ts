// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Live data layer: typed fetchers against the real LedgerCore API using the
 * session JWT. Shapes follow contracts/openapi/ledger.v1.yaml — Money is
 * { asset, amount: string } in minor units, Direction is DEBIT/CREDIT.
 */

import { AuthError, apiBaseUrl, getAccessToken } from "./session";

// ---- API shapes (mirror of the OpenAPI contract) --------------------------

export interface Money {
  asset: string;
  amount: string; // int64 minor units, string-encoded
}

export type Direction = "DEBIT" | "CREDIT";
export type ApiTxnStatus = "draft" | "posted" | "reversed" | "discarded";
export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export interface ApiLedger {
  id: string;
  name: string;
  description?: string;
  environment: "sandbox" | "live";
  created_at: string;
}

export interface ApiAccount {
  id: string;
  ledger_id: string;
  name: string;
  type: AccountType;
  normal_balance: Direction;
  status: "active" | "frozen" | "closed";
  created_at: string;
}

export interface ApiBalance {
  asset: string;
  exponent: number;
  posted: string;
  pending: string;
  available: string;
  held: string;
  posted_debits: string;
  posted_credits: string;
  version: number;
}

export interface ApiPosting {
  id?: string;
  account_id: string;
  direction: Direction;
  amount: Money;
}

export interface ApiTransaction {
  id: string;
  ledger_id: string;
  idempotency_key: string;
  reference?: string;
  description?: string;
  status: ApiTxnStatus;
  postings: ApiPosting[];
  metadata: Record<string, string>;
  reversed_by: string | null;
  reverses: string | null;
  effective_at: string;
  created_at: string;
  posted_at: string | null;
}

export interface TrialBalanceRow {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  asset: string;
  debits: string;
  credits: string;
  net: string;
}

export interface TrialBalanceTotal {
  asset: string;
  debits: string;
  credits: string;
  balanced: boolean;
}

export interface ApiTrialBalance {
  ledger_id: string;
  as_of: string;
  rows: TrialBalanceRow[];
  totals: TrialBalanceTotal[];
}

export interface ApiAssetBalance {
  asset: string;
  exponent: number;
  amount: string; // signed int64 minor units, string-encoded
}

export interface ApiStatementEntry {
  id: string;
  transaction_id: string;
  reference?: string;
  direction: Direction;
  amount: Money;
  effective_at: string;
  running_balance: string;
}

export interface ApiStatement {
  account: ApiAccount;
  period: { from: string; to: string };
  opening_balance: ApiAssetBalance[];
  entries: ApiStatementEntry[];
  closing_balance: ApiAssetBalance[];
  next_cursor: string | null;
}

interface Page<T> {
  data: T[];
  next_cursor?: string | null;
}

// ---- Errors ---------------------------------------------------------------

export class ApiDownError extends Error {
  constructor() {
    super("api_unreachable");
    this.name = "ApiDownError";
  }
}

export { AuthError };

// ---- Core fetch -----------------------------------------------------------

/** An API error answer: the HTTP status and the contract's error code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public apiMessage?: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getAccessToken();
  const method = init.method ?? "GET";
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new ApiDownError();
  }
  if (res.status === 401) throw new AuthError("token_rejected");
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    let apiMessage: string | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body.error?.code) code = body.error.code;
      apiMessage = body.error?.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, apiMessage);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** A fresh idempotency key for one console action (a retry reuses it). */
export function newIdempotencyKey(prefix: string): string {
  return `console:${prefix}:${crypto.randomUUID()}`;
}

// ---- Fetchers -------------------------------------------------------------

export function listLedgers(): Promise<Page<ApiLedger>> {
  return apiFetch<Page<ApiLedger>>("/v1/ledgers?limit=100");
}

export function listAccounts(ledgerId?: string): Promise<Page<ApiAccount>> {
  const q = ledgerId ? `&ledger_id=${encodeURIComponent(ledgerId)}` : "";
  return apiFetch<Page<ApiAccount>>(`/v1/accounts?limit=100${q}`);
}

export function getBalances(accountId: string): Promise<{ data: ApiBalance[] }> {
  return apiFetch<{ data: ApiBalance[] }>(
    `/v1/accounts/${encodeURIComponent(accountId)}/balances`,
  );
}

export function listTransactions(
  cursor?: string,
  limit = 25,
): Promise<Page<ApiTransaction>> {
  const q = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return apiFetch<Page<ApiTransaction>>(`/v1/transactions?limit=${limit}${q}`);
}

export function getStatement(
  accountId: string,
  cursor?: string,
  limit = 100,
): Promise<ApiStatement> {
  const q = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return apiFetch<ApiStatement>(
    `/v1/statements?account_id=${encodeURIComponent(accountId)}&limit=${limit}${q}`,
  );
}

export function getTrialBalance(ledgerId: string): Promise<ApiTrialBalance> {
  return apiFetch<ApiTrialBalance>(
    `/v1/trial-balance?ledger_id=${encodeURIComponent(ledgerId)}`,
  );
}

// ---- Helpers --------------------------------------------------------------

/** Display exponents for assets when the balance row is not at hand. */
const DEFAULT_EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  MXN: 2,
  GBP: 2,
  JPY: 0,
  BTC: 8,
  USDC: 6,
};

export function assetExponent(asset: string, known?: number): number {
  return known ?? DEFAULT_EXPONENTS[asset] ?? 2;
}

/** Total moved per transaction = sum of DEBIT legs, grouped by asset. */
export function transactionTotals(txn: ApiTransaction): Money[] {
  const sums = new Map<string, bigint>();
  for (const p of txn.postings) {
    if (p.direction !== "DEBIT") continue;
    sums.set(p.amount.asset, (sums.get(p.amount.asset) ?? 0n) + BigInt(p.amount.amount));
  }
  return [...sums.entries()].map(([asset, amount]) => ({
    asset,
    amount: amount.toString(),
  }));
}

// ---- Aggregated page loaders ---------------------------------------------

export interface LedgerWithAccounts {
  ledger: ApiLedger;
  accounts: Array<{ account: ApiAccount; balances: ApiBalance[] }>;
}

export async function loadLedgersTree(): Promise<LedgerWithAccounts[]> {
  const ledgers = (await listLedgers()).data;
  return Promise.all(
    ledgers.map(async (ledger) => {
      const accounts = (await listAccounts(ledger.id)).data;
      const withBalances = await Promise.all(
        accounts.map(async (account) => ({
          account,
          balances: (await getBalances(account.id)).data,
        })),
      );
      return { ledger, accounts: withBalances };
    }),
  );
}

export interface LiveTransactionsPage {
  transactions: ApiTransaction[];
  nextCursor: string | null;
  /** account id -> human name, for rendering postings. */
  accountNames: Record<string, string>;
  /** ledger id -> name. */
  ledgerNames: Record<string, string>;
}

export async function loadTransactionsPage(
  cursor?: string,
): Promise<LiveTransactionsPage> {
  const [txns, ledgers] = await Promise.all([
    listTransactions(cursor, 25),
    listLedgers(),
  ]);
  const ledgerNames = Object.fromEntries(
    ledgers.data.map((l) => [l.id, l.name]),
  );
  const accountPages = await Promise.all(
    ledgers.data.map((l) => listAccounts(l.id).catch(() => ({ data: [] }))),
  );
  const accountNames = Object.fromEntries(
    accountPages.flatMap((p) => p.data.map((a) => [a.id, a.name])),
  );
  return {
    transactions: txns.data,
    nextCursor: txns.next_cursor ?? null,
    accountNames,
    ledgerNames,
  };
}

export interface LiveDashboard {
  ledgers: ApiLedger[];
  accountCount: number;
  /** Net posted balance per asset over asset-type accounts (custody view). */
  custody: Array<{ asset: string; exponent: number; units: bigint }>;
  transactions: ApiTransaction[];
  transactionsToday: number;
  trial: ApiTrialBalance | null;
}

export async function loadDashboard(): Promise<LiveDashboard> {
  const ledgers = (await listLedgers()).data;
  const first = ledgers[0];
  if (!first) {
    return {
      ledgers,
      accountCount: 0,
      custody: [],
      transactions: [],
      transactionsToday: 0,
      trial: null,
    };
  }
  const [accountsPages, txns, trial] = await Promise.all([
    Promise.all(ledgers.map((l) => listAccounts(l.id))),
    listTransactions(undefined, 10),
    getTrialBalance(first.id).catch(() => null),
  ]);
  const accounts = accountsPages.flatMap((p) => p.data);
  const assetAccounts = accounts.filter((a) => a.type === "asset");
  const custodyMap = new Map<string, { exponent: number; units: bigint }>();
  const balancePages = await Promise.all(
    assetAccounts.map((a) => getBalances(a.id).catch(() => ({ data: [] }))),
  );
  for (const page of balancePages) {
    for (const b of page.data) {
      const prev = custodyMap.get(b.asset);
      custodyMap.set(b.asset, {
        exponent: b.exponent,
        units: (prev?.units ?? 0n) + BigInt(b.posted),
      });
    }
  }
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  return {
    ledgers,
    accountCount: accounts.length,
    custody: [...custodyMap.entries()].map(([asset, v]) => ({
      asset,
      exponent: v.exponent,
      units: v.units,
    })),
    transactions: txns.data,
    transactionsToday: txns.data.filter(
      (t) => new Date(t.created_at).getTime() >= dayAgo,
    ).length,
    trial,
  };
}

// ---- Provider exposure (6.3) and provider freeze (6.26) ---------------------

export type LossAllocation = "pro_rata_pool" | "by_provider";

export interface ExposureBreak {
  kind: "ledger_shortfall" | "negative_custody" | "provider_shortfall";
  provider?: string;
  asset: string;
  exponent: number;
  amount: string;
}

export interface ExposureRow {
  provider: string;
  asset: string;
  exponent: number;
  custody: string;
  claims: string;
  own: string;
  payable: string;
}

export interface ApiProviderExposure {
  ledger_id: string;
  as_of?: string;
  loss_allocation: LossAllocation | null;
  backed: boolean;
  breaks: ExposureBreak[];
  data: ExposureRow[];
}

export interface MatrixRow {
  holder: string;
  asset: string;
  exponent: number;
  balance: string;
  shares: Array<{ provider: string; amount: string }>;
  unplaced: string;
}

export interface ApiExposureMatrix {
  ledger_id: string;
  as_of?: string;
  loss_allocation: LossAllocation;
  data: MatrixRow[];
}

export function getProviderExposure(ledgerId: string): Promise<ApiProviderExposure> {
  return apiFetch(`/v1/ledgers/${encodeURIComponent(ledgerId)}/provider-exposure`);
}

export function getExposureMatrix(ledgerId: string): Promise<ApiExposureMatrix> {
  return apiFetch(`/v1/ledgers/${encodeURIComponent(ledgerId)}/exposure-matrix`);
}

export type FreezeMode = "all" | "debits" | "credits";

export function freezeProvider(
  ledgerId: string,
  provider: string,
  body: { mode: FreezeMode; reason: string; case_ref?: string },
): Promise<{ data: ApiAccount[] }> {
  return apiFetch(
    `/v1/ledgers/${encodeURIComponent(ledgerId)}/providers/${encodeURIComponent(provider)}/freeze`,
    { method: "POST", body },
  );
}

export function unfreezeProvider(
  ledgerId: string,
  provider: string,
  body: { reason: string; case_ref?: string },
): Promise<{ data: ApiAccount[] }> {
  return apiFetch(
    `/v1/ledgers/${encodeURIComponent(ledgerId)}/providers/${encodeURIComponent(provider)}/unfreeze`,
    { method: "POST", body },
  );
}

// ---- Movements (6.36) -------------------------------------------------------

export type MovementStatus =
  | "open"
  | "authorized"
  | "captured"
  | "dispatched"
  | "completed"
  | "failed"
  | "cancelled";

export interface MovementFigures {
  asset: string;
  transit: string;
  revenue: string;
  cost: string;
  margin: string;
}

export interface ApiMovement {
  id: string;
  ledger_id: string;
  type: string;
  reference?: string;
  status: MovementStatus;
  fx_quote_id: string | null;
  opened_at: string;
  last_stage_at: string;
  closed_at: string | null;
  transit_residual: Money[] | null;
  metadata: Record<string, string>;
  stale_at: string | null;
  parent_movement_id: string | null;
  figures?: MovementFigures[];
}

export interface MovementSummaryRow {
  type: string;
  asset: string;
  movements: number;
  revenue: string;
  cost: string;
  margin: string;
}

export interface MovementFilters {
  ledger_id?: string;
  status?: MovementStatus;
  type?: string;
  reference?: string;
  opened_after?: string;
  opened_before?: string;
}

/** Query string of the non-empty entries ("" when none). */
export function queryString(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listMovements(
  filters: MovementFilters,
  cursor?: string,
): Promise<Page<ApiMovement>> {
  return apiFetch(`/v1/movements${queryString({ ...filters, limit: 50, cursor })}`);
}

export function summarizeMovements(params: {
  ledger_id?: string;
  from?: string;
  to?: string;
}): Promise<{ data: MovementSummaryRow[] }> {
  return apiFetch(`/v1/movements/summary${queryString(params)}`);
}

export function openMovement(body: {
  ledger_id: string;
  idempotency_key: string;
  type: string;
  reference?: string;
  parent_movement_id?: string;
}): Promise<ApiMovement> {
  return apiFetch("/v1/movements", { method: "POST", body });
}

export function closeMovement(
  id: string,
  outcome: "completed" | "failed" | "cancelled",
): Promise<ApiMovement> {
  return apiFetch(`/v1/movements/${encodeURIComponent(id)}/close`, {
    method: "POST",
    body: { outcome },
  });
}
