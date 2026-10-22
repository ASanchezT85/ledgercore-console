// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Live data layer: typed fetchers against the real LedgerCore API using the
 * session JWT. Shapes follow contracts/openapi/ledger.v1.yaml — Money is
 * { asset, amount: string } in minor units, Direction is DEBIT/CREDIT.
 */

import { AuthError, apiBaseUrl, getAccessToken, requestStepUp } from "./session";

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
  metadata_policy?: {
    transaction_keys?: string[] | null;
    account_keys?: string[] | null;
  };
  require_fx_quote?: boolean;
  loss_allocation?: "pro_rata_pool" | "by_provider" | null;
  stale_movement_after?: string | null;
  created_at: string;
}

export interface ApiAccount {
  id: string;
  ledger_id: string;
  name: string;
  type: AccountType;
  normal_balance: Direction;
  status: "active" | "frozen" | "closed";
  allow_negative?: boolean;
  fund_class?: "customer" | "own";
  liquidity?: "liquid" | "claim";
  transit?: boolean;
  postable?: boolean;
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
  /** Effective reversal state; only on GET /v1/transactions/{id}. */
  reversal?: {
    effective_status: "posted" | "partially_reversed" | "reversed";
    reversed_amount?: Money;
  };
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
  /** Present on a parent-account statement: the account the entry hit. */
  account_id?: string;
  account_path?: string;
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

export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  try {
    return await apiFetchOnce<T>(path, init);
  } catch (err) {
    // A write at or above the ledger's step-up threshold (ADR-030): ask for a
    // fresh code and retry once with the elevated token. Nothing was written,
    // so the retry (same idempotency key) is safe.
    if (err instanceof ApiError && err.code === "step_up_required" && (await requestStepUp())) {
      return apiFetchOnce<T>(path, init);
    }
    throw err;
  }
}

async function apiFetchOnce<T>(
  path: string,
  init: { method?: string; body?: unknown },
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
        // multipart bodies get their boundary from the browser
        ...(init.body !== undefined && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        init.body === undefined
          ? undefined
          : init.body instanceof FormData
            ? init.body
            : JSON.stringify(init.body),
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

/** The contract's error code (and message) of a failed call, for display. */
export function apiErrorText(err: unknown): string {
  if (err instanceof ApiError)
    return `${err.code}${err.apiMessage ? ` — ${err.apiMessage}` : ""}`;
  return err instanceof Error ? err.message : "unknown_error";
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

export interface TransactionFilters {
  ledger_id?: string;
  status?: ApiTxnStatus;
  /** A parent account matches its whole subtree. */
  account_id?: string;
  metadata_key?: string;
  metadata_value?: string;
}

export function listTransactions(
  cursor?: string,
  limit = 25,
  filters: TransactionFilters = {},
): Promise<Page<ApiTransaction>> {
  return apiFetch<Page<ApiTransaction>>(
    `/v1/transactions${queryString({ ...filters, limit, cursor })}`,
  );
}

export function getTransaction(id: string): Promise<ApiTransaction> {
  return apiFetch(`/v1/transactions/${encodeURIComponent(id)}`);
}

/** Reverses a posted transaction; `amount` makes it a partial reversal (6.12). */
export function reverseTransaction(
  id: string,
  body: { idempotency_key: string; reason?: string; amount?: Money },
): Promise<ApiTransaction> {
  return apiFetch(`/v1/transactions/${encodeURIComponent(id)}/reverse`, {
    method: "POST",
    body,
  });
}

export interface StatementFilters {
  /** RFC 3339; the API defaults to `to` minus 30 days. */
  from?: string;
  /** RFC 3339; the API defaults to now. */
  to?: string;
  metadata_key?: string;
  metadata_value?: string;
}

export function getStatement(
  accountId: string,
  cursor?: string,
  limit = 100,
  filters: StatementFilters = {},
): Promise<ApiStatement> {
  return apiFetch<ApiStatement>(
    `/v1/statements${queryString({ account_id: accountId, limit, cursor, ...filters })}`,
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
  filters: TransactionFilters = {},
): Promise<LiveTransactionsPage> {
  const [txns, ledgers] = await Promise.all([
    listTransactions(cursor, 25, filters),
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

// ---- Provider positions -------------------------------------------------------

export interface ProviderPosition {
  provider: string;
  positions: Array<{
    asset: string;
    exponent: number;
    net: string;
    direction: "they_owe_us" | "we_owe_them" | "flat";
    accounts: string[];
  }>;
}

/** With `ledgerId` that ledger only; without it, consolidated over the tenant (6.23). */
export function listProviderPositions(ledgerId?: string): Promise<{
  data: ProviderPosition[];
  hint?: string;
}> {
  return apiFetch(`/v1/provider-positions${queryString({ ledger_id: ledgerId })}`);
}

// ---- FX position (6.16) ---------------------------------------------------------

export interface FxPositionValue {
  conversion_net: string;
  customer_assets: string;
  customer_liabilities: string;
  quote_id?: string;
}

export interface ApiFxPosition {
  ledger_id: string;
  reporting_asset?: string;
  data: Array<{
    asset: string;
    exponent: number;
    conversion_net: string;
    customer_assets: string;
    customer_liabilities: string;
    value?: FxPositionValue;
  }>;
  total?: FxPositionValue;
  unvalued?: string[];
}

/** `quoteIds` are the FX quotes to value with; they need `reportingAsset`. */
export function getFxPosition(
  ledgerId: string,
  reportingAsset?: string,
  quoteIds: string[] = [],
): Promise<ApiFxPosition> {
  const qs = [
    reportingAsset ? `reporting_asset=${encodeURIComponent(reportingAsset)}` : "",
    ...quoteIds.map((q) => `quote_id=${encodeURIComponent(q)}`),
  ].filter(Boolean);
  return apiFetch(
    `/v1/ledgers/${encodeURIComponent(ledgerId)}/fx-position${qs.length ? `?${qs.join("&")}` : ""}`,
  );
}

// ---- Writes: ledgers, accounts, transactions, holds ---------------------------

export function createLedger(body: {
  name: string;
  description?: string;
}): Promise<ApiLedger> {
  return apiFetch("/v1/ledgers", { method: "POST", body });
}

export function createAccount(body: {
  ledger_id: string;
  name: string;
  type: AccountType;
  normal_balance: Direction;
  allow_negative?: boolean;
  fund_class?: "customer" | "own";
  liquidity?: "liquid" | "claim";
  transit?: boolean;
  metadata?: Record<string, string>;
}): Promise<ApiAccount> {
  return apiFetch("/v1/accounts", { method: "POST", body });
}

export function freezeAccount(
  id: string,
  body: { mode: FreezeMode; reason: string; case_ref?: string },
): Promise<{ data: ApiAccount[] }> {
  return apiFetch(`/v1/accounts/${encodeURIComponent(id)}/freeze`, {
    method: "POST",
    body,
  });
}

export function unfreezeAccount(
  id: string,
  body: { reason: string; case_ref?: string },
): Promise<{ data: ApiAccount[] }> {
  return apiFetch(`/v1/accounts/${encodeURIComponent(id)}/unfreeze`, {
    method: "POST",
    body,
  });
}

export function createTransaction(body: {
  ledger_id: string;
  idempotency_key: string;
  reference?: string;
  description?: string;
  status: "draft" | "posted";
  postings: ApiPosting[];
  metadata?: Record<string, string>;
}): Promise<ApiTransaction> {
  return apiFetch("/v1/transactions", { method: "POST", body });
}

export function postTransaction(id: string): Promise<ApiTransaction> {
  return apiFetch(`/v1/transactions/${encodeURIComponent(id)}/post`, {
    method: "POST",
  });
}

export function discardTransaction(id: string): Promise<ApiTransaction> {
  return apiFetch(`/v1/transactions/${encodeURIComponent(id)}/discard`, {
    method: "POST",
  });
}

export type HoldStatus = "active" | "captured" | "released" | "expired";

export interface ApiHold {
  id: string;
  ledger_id: string;
  account_id: string;
  idempotency_key: string;
  amount: Money;
  status: HoldStatus;
  transaction_id: string | null;
  expires_at: string;
  created_at: string;
}

export function createHold(body: {
  account_id: string;
  idempotency_key: string;
  amount: Money;
  expires_at?: string;
}): Promise<ApiHold> {
  return apiFetch("/v1/holds", { method: "POST", body });
}

export function createProviderHold(
  ledgerId: string,
  provider: string,
  body: { idempotency_key: string; amount: Money; expires_at?: string },
): Promise<ApiHold> {
  return apiFetch(
    `/v1/ledgers/${encodeURIComponent(ledgerId)}/providers/${encodeURIComponent(provider)}/holds`,
    { method: "POST", body },
  );
}

export function getHold(id: string): Promise<ApiHold> {
  return apiFetch(`/v1/holds/${encodeURIComponent(id)}`);
}

export function captureHold(
  id: string,
  body: { amount?: Money; transaction_id?: string } = {},
): Promise<ApiHold> {
  return apiFetch(`/v1/holds/${encodeURIComponent(id)}/capture`, {
    method: "POST",
    body,
  });
}

export function releaseHold(id: string): Promise<ApiHold> {
  return apiFetch(`/v1/holds/${encodeURIComponent(id)}/release`, {
    method: "POST",
  });
}

// ---- Ledger policies and coverage ---------------------------------------------

export function setCustodyPolicy(
  ledgerId: string,
  loss_allocation: LossAllocation,
): Promise<ApiLedger> {
  return apiFetch(`/v1/ledgers/${encodeURIComponent(ledgerId)}/custody-policy`, {
    method: "PUT",
    body: { loss_allocation },
  });
}

export function setFxPolicy(
  ledgerId: string,
  require_fx_quote: boolean,
): Promise<ApiLedger> {
  return apiFetch(`/v1/ledgers/${encodeURIComponent(ledgerId)}/fx-policy`, {
    method: "PUT",
    body: { require_fx_quote },
  });
}

/** A Go duration ("720h") or null to turn the stale check off. */
export function setMovementPolicy(
  ledgerId: string,
  stale_movement_after: string | null,
): Promise<ApiLedger> {
  return apiFetch(`/v1/ledgers/${encodeURIComponent(ledgerId)}/movement-policy`, {
    method: "PUT",
    body: { stale_movement_after },
  });
}

export function setMetadataPolicy(
  ledgerId: string,
  body: { transaction_keys: string[] | null; account_keys: string[] | null },
): Promise<ApiLedger> {
  return apiFetch(`/v1/ledgers/${encodeURIComponent(ledgerId)}/metadata-policy`, {
    method: "PUT",
    body,
  });
}

export interface CoverageRow {
  asset: string;
  exponent: number;
  customer_assets: string;
  customer_claims: string;
  customer_liabilities: string;
  customer_receivables: string;
  negative_accounts: number;
  covered: boolean;
  shortfall: string;
}

export interface ApiCoverage {
  ledger_id: string;
  as_of?: string;
  covered: boolean;
  data: CoverageRow[];
}

export interface ApiCoverageSnapshot {
  id: string;
  ledger_id: string;
  as_of: string;
  taken_at: string;
  taken_by: string;
  snapshot_hash: string;
  covered: boolean;
  data: CoverageRow[];
}

export function getCoverage(ledgerId: string): Promise<ApiCoverage> {
  return apiFetch(`/v1/ledgers/${encodeURIComponent(ledgerId)}/coverage`);
}

export function createCoverageSnapshot(
  ledgerId: string,
  as_of: string,
): Promise<ApiCoverageSnapshot> {
  return apiFetch(
    `/v1/ledgers/${encodeURIComponent(ledgerId)}/coverage-snapshots`,
    { method: "POST", body: { as_of } },
  );
}

export function listCoverageSnapshots(
  ledgerId: string,
): Promise<Page<ApiCoverageSnapshot>> {
  return apiFetch(
    `/v1/ledgers/${encodeURIComponent(ledgerId)}/coverage-snapshots?limit=20`,
  );
}

// ---- Periods, adjustments, FX quotes, ledger transfers, audit log -------------

export type PeriodStatus = "open" | "soft_closed" | "hard_closed";

export interface ApiPeriod {
  id: string;
  ledger_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: PeriodStatus;
  created_at: string;
  updated_at: string;
}

export function listPeriods(ledgerId: string): Promise<Page<ApiPeriod>> {
  return apiFetch(`/v1/periods${queryString({ ledger_id: ledgerId, limit: 100 })}`);
}

export function createPeriod(body: {
  ledger_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
}): Promise<ApiPeriod> {
  return apiFetch("/v1/periods", { method: "POST", body });
}

export function transitionPeriod(
  id: string,
  status: PeriodStatus,
): Promise<ApiPeriod> {
  return apiFetch(`/v1/periods/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status },
  });
}

export type AdjustmentStatus =
  | "pending"
  | "approved"
  | "executed"
  | "rejected"
  | "cancelled";

export interface ApiAdjustment {
  id: string;
  ledger_id: string;
  idempotency_key: string;
  status: AdjustmentStatus;
  request_hash: string;
  maker: string;
  reference?: string;
  description?: string;
  effective_at: string;
  adjusts_period_id: string | null;
  postings: ApiPosting[];
  approvals: Array<{ approver: string; request_hash: string; approved_at: string }>;
  transaction_id: string | null;
  created_at: string;
}

export function listAdjustments(
  ledgerId: string,
  status?: AdjustmentStatus,
): Promise<Page<ApiAdjustment>> {
  return apiFetch(
    `/v1/adjustment-requests${queryString({ ledger_id: ledgerId, status, limit: 100 })}`,
  );
}

export function createAdjustment(body: {
  ledger_id: string;
  idempotency_key: string;
  effective_at: string;
  adjusts_period_id?: string;
  reference?: string;
  description?: string;
  postings: ApiPosting[];
}): Promise<ApiAdjustment> {
  return apiFetch("/v1/adjustment-requests", { method: "POST", body });
}

export function actOnAdjustment(
  id: string,
  action: "approve" | "reject" | "cancel" | "execute",
  request_hash?: string,
): Promise<ApiAdjustment | ApiTransaction> {
  return apiFetch(`/v1/adjustment-requests/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    ...(action === "approve" ? { body: { request_hash } } : {}),
  });
}

export interface ApiFxQuote {
  id: string;
  base_asset: string;
  quote_asset: string;
  rate: string;
  source: string;
  quoted_at: string;
  expires_at: string;
}

export function createFxQuote(body: {
  base_asset: string;
  quote_asset: string;
  rate: string;
  source: string;
  expires_at: string;
}): Promise<ApiFxQuote> {
  return apiFetch("/v1/fx-quotes", { method: "POST", body });
}

export function getFxQuote(id: string): Promise<ApiFxQuote> {
  return apiFetch(`/v1/fx-quotes/${encodeURIComponent(id)}`);
}

export interface TransferSideInput {
  ledger_id: string;
  due_account_id: string;
  postings: ApiPosting[];
}

export interface ApiLedgerTransfer {
  id: string;
  idempotency_key: string;
  reference?: string;
  source: { ledger_id: string; due_account_id: string; transaction: ApiTransaction };
  target: { ledger_id: string; due_account_id: string; transaction: ApiTransaction };
  created_at: string;
}

export function createLedgerTransfer(body: {
  idempotency_key: string;
  reference?: string;
  source: TransferSideInput;
  target: TransferSideInput;
  fx?: { quote_id: string; account_id: string };
}): Promise<ApiLedgerTransfer> {
  return apiFetch("/v1/ledger-transfers", { method: "POST", body });
}

export function getLedgerTransfer(id: string): Promise<ApiLedgerTransfer> {
  return apiFetch(`/v1/ledger-transfers/${encodeURIComponent(id)}`);
}

export interface ApiAuditEntry {
  id: number;
  occurred_at: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  request_id?: string;
  chain_seq: number;
  prev_hash: string;
  entry_hash: string;
}

export interface AuditFilters {
  from?: string;
  to?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
}

export function listAuditLog(
  filters: AuditFilters,
  cursor?: string,
): Promise<Page<ApiAuditEntry>> {
  return apiFetch(`/v1/audit-log${queryString({ ...filters, limit: 50, cursor })}`);
}

export interface ApiAuditVerification {
  ok: boolean;
  head: { chain_seq: number; entry_hash: string; occurred_at: string | null };
  breaks: Array<{ chain_seq: number; problem: string; stored: string; expected: string }>;
}

export function verifyAuditLog(): Promise<ApiAuditVerification> {
  return apiFetch("/v1/audit-log/verify");
}

// ---- Posting rules, events and groups ------------------------------------------

export interface ApiPostingRule {
  id: string;
  ledger_id: string;
  event_type: string;
  version: number;
  description?: string;
  lines: Array<Record<string, unknown>>;
  computed?: Array<Record<string, unknown>>;
  fx?: Record<string, unknown>;
  rule_hash: string;
  created_at: string;
}

export function listPostingRules(ledgerId: string): Promise<Page<ApiPostingRule>> {
  return apiFetch(`/v1/posting-rules${queryString({ ledger_id: ledgerId, limit: 100 })}`);
}

/** Rules, events and groups carry nested contracts; the console sends them as the API defines them. */
export function createPostingRule(body: Record<string, unknown>): Promise<ApiPostingRule> {
  return apiFetch("/v1/posting-rules", { method: "POST", body });
}

export function createPostingEvent(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch("/v1/posting-events", { method: "POST", body });
}

export function getPostingEvent(id: string): Promise<Record<string, unknown>> {
  return apiFetch(`/v1/posting-events/${encodeURIComponent(id)}`);
}

export function createPostingGroup(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch("/v1/posting-groups", { method: "POST", body });
}

export function getPostingGroup(id: string): Promise<Record<string, unknown>> {
  return apiFetch(`/v1/posting-groups/${encodeURIComponent(id)}`);
}

// ---- Webhooks --------------------------------------------------------------------

export const WEBHOOK_EVENT_TYPES = [
  "*",
  "ledger.transaction.posted",
  "ledger.transaction.reversed",
  "ledger.transaction.discarded",
  "ledger.hold.created",
  "ledger.hold.captured",
  "ledger.hold.released",
  "ledger.hold.expired",
  "ledger.hold.extended",
  "ledger.account.updated",
  "recon.discrepancy.detected",
] as const;

export interface ApiSubscription {
  id: string;
  url: string;
  event_types: string[];
  active: boolean;
  created_at: string;
  /** Only on create: shown exactly once. */
  secret?: string;
}

export type DeliveryStatus = "pending" | "delivered" | "failed" | "dead";

export interface ApiDelivery {
  id: string;
  subscription_id: string;
  event_id: string;
  event_type: string;
  status: DeliveryStatus;
  attempts: number;
  next_attempt_at: string;
  last_status_code: number | null;
  last_error: string | null;
  created_at: string;
  delivered_at: string | null;
}

export function listSubscriptions(): Promise<Page<ApiSubscription>> {
  return apiFetch("/v1/webhook-subscriptions?limit=100");
}

export function createSubscription(body: {
  url: string;
  event_types: string[];
}): Promise<ApiSubscription> {
  return apiFetch("/v1/webhook-subscriptions", { method: "POST", body });
}

export function updateSubscription(
  id: string,
  body: { url?: string; event_types?: string[]; active?: boolean },
): Promise<ApiSubscription> {
  return apiFetch(`/v1/webhook-subscriptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}

export function rotateSubscriptionSecret(
  id: string,
): Promise<{ id: string; secret: string; previous_secret_expires_at: string }> {
  return apiFetch(`/v1/webhook-subscriptions/${encodeURIComponent(id)}/rotate-secret`, {
    method: "POST",
  });
}

export function listDeliveries(
  filters: { subscription_id?: string; status?: DeliveryStatus },
  cursor?: string,
): Promise<Page<ApiDelivery>> {
  return apiFetch(`/v1/webhook-deliveries${queryString({ ...filters, limit: 50, cursor })}`);
}

export function retryDelivery(id: string): Promise<ApiDelivery> {
  return apiFetch(`/v1/webhook-deliveries/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  });
}
