// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Holds: reserve funds on an account (or a provider's custody), then capture
 * or release them. The API has no hold list, so the page keeps the holds
 * created or looked up in this visit and refreshes each from the API after an
 * action.
 */

import { useEffect, useState } from "react";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { LedgerScope } from "@/components/ledger-scope";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatMoneyWithAsset } from "@/lib/format";
import {
  apiErrorText,
  assetExponent,
  captureHold,
  createHold,
  createProviderHold,
  getHold,
  listAccounts,
  newIdempotencyKey,
  releaseHold,
  type ApiAccount,
  type ApiHold,
  type HoldStatus,
} from "@/lib/live";

const TONE: Record<HoldStatus, BadgeTone> = {
  active: "sky",
  captured: "emerald",
  released: "slate",
  expired: "amber",
};

function NewHold({
  ledgerId,
  onCreated,
}: {
  ledgerId: string;
  onCreated: (h: ApiHold) => void;
}) {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [target, setTarget] = useState<"account" | "provider">("account");
  const [accountId, setAccountId] = useState("");
  const [provider, setProvider] = useState("");
  const [asset, setAsset] = useState("USD");
  const [amount, setAmount] = useState("");
  const [expires, setExpires] = useState("");
  const [key] = useState(() => newIdempotencyKey("hold"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAccounts(ledgerId).then(
      (p) => setAccounts(p.data),
      () => undefined,
    );
  }, [ledgerId]);

  const ok =
    /^[1-9]\d*$/.test(amount) &&
    asset.trim() !== "" &&
    (target === "account" ? accountId !== "" : provider.trim() !== "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        idempotency_key: key,
        amount: { asset: asset.trim().toUpperCase(), amount },
        ...(expires ? { expires_at: new Date(expires).toISOString() } : {}),
      };
      onCreated(
        target === "account"
          ? await createHold({ ...body, account_id: accountId })
          : await createProviderHold(ledgerId, provider.trim(), body),
      );
      setAmount("");
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="New hold"
      subtitle="Reserves funds without moving them. A provider hold reserves that provider's custody for a dispatch."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Reserve on">
          <select
            className={inputClass}
            value={target}
            onChange={(e) => setTarget(e.target.value as typeof target)}
          >
            <option value="account">an account</option>
            <option value="provider">a provider&apos;s custody</option>
          </select>
        </Field>
        {target === "account" ? (
          <Field label="Account" className="sm:col-span-2">
            <select
              className={inputClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Choose…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Provider name" className="sm:col-span-2">
            <input
              className={inputClass}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </Field>
        )}
        <Field label="Asset">
          <input
            className={inputClass}
            value={asset}
            maxLength={16}
            onChange={(e) => setAsset(e.target.value)}
          />
        </Field>
        <Field label="Amount (minor units)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Expires (default 7 days)">
          <input
            type="datetime-local"
            className={inputClass}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </Field>
      </div>
      <ErrorLine message={error} />
      <div className="mt-4">
        <Button size="sm" disabled={!ok || busy} onClick={() => void submit()}>
          {busy ? "Reserving…" : "Create hold"}
        </Button>
      </div>
    </Card>
  );
}

function HoldRow({
  hold,
  onChanged,
}: {
  hold: ApiHold;
  onChanged: (h: ApiHold, msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState<"capture" | "release" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fmt = (v: string) =>
    formatMoneyWithAsset(BigInt(v), hold.amount.asset, assetExponent(hold.amount.asset));

  async function run() {
    setBusy(true);
    setError(null);
    try {
      if (pending === "capture") {
        const h = await captureHold(
          hold.id,
          amount ? { amount: { asset: hold.amount.asset, amount } } : {},
        );
        onChanged(h, `Hold ${h.id} captured.`);
      } else {
        const h = await releaseHold(hold.id);
        onChanged(h, `Hold ${h.id} released.`);
      }
      setPending(null);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 border-t border-edge py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-ink">{hold.id}</span>
        <span className="flex items-center gap-2">
          <span className="num text-ink">{fmt(hold.amount.amount)}</span>
          <Badge tone={TONE[hold.status]}>{hold.status}</Badge>
        </span>
      </div>
      <p className="text-ink-faint">
        account {hold.account_id} · expires {formatDateTime(hold.expires_at)}
      </p>
      {hold.status === "active" && (
        <div className="flex flex-wrap items-center gap-2">
          {pending === null ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setPending("capture")}>
                Capture…
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPending("release")}>
                Release…
              </Button>
            </>
          ) : (
            <>
              {pending === "capture" && (
                <input
                  className={`${inputClass} w-56`}
                  inputMode="numeric"
                  placeholder="amount (empty = all)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                />
              )}
              <span className="text-ink">
                {pending === "capture"
                  ? "Capture frees the held funds; post the transaction separately."
                  : "Release frees the funds without moving money."}
              </span>
              <Button size="sm" disabled={busy} onClick={() => void run()}>
                {busy ? "Working…" : "Confirm"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending(null)}>
                Back
              </Button>
            </>
          )}
        </div>
      )}
      <ErrorLine message={error} />
    </li>
  );
}

function HoldsBody({ ledgerId }: { ledgerId: string }) {
  const [holds, setHolds] = useState<ApiHold[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState<string | null>(null);

  const upsert = (h: ApiHold) =>
    setHolds((hs) => [h, ...hs.filter((x) => x.id !== h.id)]);

  return (
    <>
      <Notice message={notice} />
      <NewHold
        ledgerId={ledgerId}
        onCreated={(h) => {
          upsert(h);
          setNotice(`Hold ${h.id} created.`);
        }}
      />
      <Card
        title="Holds in this visit"
        actions={
          <span className="flex items-center gap-2">
            <input
              className={`${inputClass} w-72`}
              placeholder="Look up a hold by id"
              value={lookup}
              onChange={(e) => setLookup(e.target.value.trim())}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={lookup === ""}
              onClick={async () => {
                setError(null);
                try {
                  upsert(await getHold(lookup));
                  setLookup("");
                } catch (e) {
                  setError(apiErrorText(e));
                }
              }}
            >
              Find
            </Button>
          </span>
        }
      >
        <ErrorLine message={error} />
        {holds.length === 0 ? (
          <p className="text-sm text-ink-faint">Create a hold or look one up by id.</p>
        ) : (
          <ul>
            {holds.map((h) => (
              <HoldRow
                key={h.id}
                hold={h}
                onChanged={(nh, m) => {
                  upsert(nh);
                  setNotice(m);
                }}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function HoldsView() {
  return (
    <LedgerScope
      title="Holds"
      subtitle="Reserve, capture and release funds"
      demoNote="Sign in to manage holds on your ledgers."
    >
      {(ledger) => <HoldsBody ledgerId={ledger.id} />}
    </LedgerScope>
  );
}
