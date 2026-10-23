// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

/**
 * Account onboarding (roadmap 7.4, ADR-024): the signup form, the email and
 * phone codes and the request for review. Everything goes through the same
 * same-origin proxy as the session (`identityFetch`); the checks done here are
 * advice for the person typing — identity validates everything again.
 */

import { identityFetch } from "@/lib/session";

export type AccountStatus =
  | "registered"
  | "email_verified"
  | "mfa_enrolled"
  | "sandbox"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

export interface AccountProfile {
  kind: "company" | "person";
  legal_name: string;
  registration_number: string;
  tax_id: string;
  country: string;
  region: string;
  city: string;
  address_line: string;
  postal_code: string;
  website: string;
  phone: string;
}

export interface Onboarding {
  tenant_id: string;
  status: AccountStatus;
  steps: { email_verified: boolean; two_factor_enrolled: boolean; phone_verified: boolean };
  profile: AccountProfile | null;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason?: string;
  status_changed_at: string;
}

/** Statuses in which the console is not usable yet: the person must finish the steps. */
export const PRE_SANDBOX: AccountStatus[] = ["registered", "email_verified", "mfa_enrolled"];

const PENDING_EMAIL_KEY = "lc_pending_email";

/** The address just registered, so the verification page can prefill it (session-scoped, never in the URL). */
export function rememberPendingEmail(email: string) {
  try {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    /* storage blocked: the person types it again */
  }
}

export function pendingEmail(): string {
  try {
    return window.sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetPendingEmail() {
  try {
    window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    /* nothing to forget */
  }
}

export function registerAccount(input: { email: string; password: string; profile: AccountProfile }) {
  return identityFetch<{ tenant_id: string; status: AccountStatus }>("POST", "onboarding/accounts", input);
}

export function verifyEmail(email: string, code: string) {
  return identityFetch<void>("POST", "onboarding/email/verify", { email: email.trim(), code: code.replace(/\D/g, "") });
}

export function resendEmailCode(email: string) {
  return identityFetch<void>("POST", "onboarding/email/resend", { email: email.trim() });
}

export function getOnboarding() {
  return identityFetch<Onboarding>("GET", "onboarding");
}

export function sendPhoneCode() {
  return identityFetch<void>("POST", "onboarding/phone/send", {}, { csrf: true });
}

export function verifyPhone(code: string) {
  return identityFetch<void>("POST", "onboarding/phone/verify", { code: code.replace(/\D/g, "") }, { csrf: true });
}

export function requestReview() {
  return identityFetch<void>("POST", "onboarding/review", {}, { csrf: true });
}

/** ISO 3166-1 alpha-2 codes identity accepts; names come from Intl in the visitor's language. */
const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI
GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK
LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH
PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO
TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);

export function countryOptions(lang: string): { code: string; name: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([lang], { type: "region" });
  } catch {
    /* old runtime: show the codes */
  }
  return COUNTRY_CODES.map((code) => ({ code, name: names?.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, lang),
  );
}
