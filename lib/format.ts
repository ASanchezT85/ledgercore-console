// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

/**
 * Formatting helpers for the console.
 *
 * Monetary amounts across LedgerCore are integers in minor units plus an
 * asset code and an exponent from the asset registry. Formatting NEVER goes
 * through floats: everything is done with BigInt and string padding.
 */

const ASSET_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  MXN: "MX$",
  GBP: "£",
};

/**
 * Formats an amount expressed in integer minor units into a human string,
 * e.g. formatMoney(1284503217n, "USD", 2) => "$12,845,032.17".
 */
export function formatMoney(
  units: bigint | number,
  asset: string,
  exponent: number,
): string {
  const value = typeof units === "bigint" ? units : BigInt(Math.trunc(units));
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const digits = abs.toString().padStart(exponent + 1, "0");
  const intPart = exponent > 0 ? digits.slice(0, -exponent) : digits;
  const fracPart = exponent > 0 ? digits.slice(-exponent) : "";

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = ASSET_SYMBOLS[asset] ?? "";
  const body = fracPart.length > 0 ? `${grouped}.${fracPart}` : grouped;

  return `${negative ? "-" : ""}${symbol}${body}`;
}

/** Formats an amount together with its asset code: "$97.00 USD". */
export function formatMoneyWithAsset(
  units: bigint | number,
  asset: string,
  exponent: number,
): string {
  return `${formatMoney(units, asset, exponent)} ${asset}`;
}

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Deterministic UTC date-time formatter ("Jul 24, 2026, 14:32 UTC").
 * Manual formatting keeps server and client output identical regardless of
 * locale data, avoiding hydration mismatches.
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = MONTHS_EN[d.getUTCMonth()] ?? "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** Short date without time ("Jul 24, 2026"). */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = MONTHS_EN[d.getUTCMonth()] ?? "";
  return `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Integer with thousands separators: 18942 => "18,942". */
export function formatInt(value: number): string {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Percentage with two decimals: 99.98 => "99.98%" (recon precision matters). */
export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Parses a decimal amount typed by a person ("12.5") into integer minor units
 * for an asset with `exponent` decimals. Null when it is not a positive amount
 * with at most `exponent` decimals.
 */
export function parseMinorUnits(input: string, exponent: number): bigint | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > exponent) return null;
  const units = BigInt(m[1] + frac.padEnd(exponent, "0"));
  return units > 0n ? units : null;
}
