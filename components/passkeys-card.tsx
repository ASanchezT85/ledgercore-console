// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  addPasskey,
  CodeError,
  listPasskeys,
  LockedError,
  PasskeyCancelled,
  passkeysSupported,
  revokePasskey,
  type Passkey,
} from "@/lib/session";

/** Your passkeys (WebAuthn): a second 2FA method next to the authenticator app. Adding one asks for a fresh app code. */
export function PasskeysCard() {
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listPasskeys()
      .then(setKeys)
      .catch(() => setKeys([]));
  }, []);

  useEffect(() => {
    setSupported(passkeysSupported());
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await addPasskey(code.trim(), name.trim());
      setAdding(false);
      setName("");
      setCode("");
      load();
    } catch (err) {
      setCode("");
      if (err instanceof PasskeyCancelled) setError("The passkey was not created. Try again.");
      else if (err instanceof CodeError) setError("Wrong or already used code. Wait for the next one in your app.");
      else if (err instanceof LockedError) setError(`Too many attempts. Try again in ${err.retryAfter} s.`);
      else setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k: Passkey) {
    if (busy || !window.confirm(`Revoke the passkey "${k.name}"? It stops working at once.`)) return;
    setBusy(true);
    setError(null);
    try {
      await revokePasskey(k.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Your passkeys" subtitle="Fingerprint, face, screen lock or a security key, as a second factor">
      <p className="text-sm text-ink-muted">
        A passkey replaces typing the code at sign-in and when a large operation asks you to confirm. The authenticator
        app and the recovery codes keep working.
      </p>
      {keys && keys.length > 0 && (
        <ul className="mt-3 divide-y divide-edge rounded-lg border border-edge">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-ink">{k.name}</span>
                <span className="ml-2 text-xs text-ink-faint">
                  added {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at ? `, used ${new Date(k.last_used_at).toLocaleDateString()}` : ", never used"}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void revoke(k)}
                className="text-xs text-danger hover:underline disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      {!supported ? (
        <p className="mt-3 text-xs text-ink-faint">This browser cannot create passkeys.</p>
      ) : adding ? (
        <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Name (optional)</span>
            <input
              type="text"
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Work laptop"
              className="h-10 w-44 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 text-sm text-ink"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Code from your app</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              placeholder="123456"
              className="h-10 w-36 rounded-(--radius-control) border border-edge-strong bg-surface-raised px-3 font-mono text-sm tracking-widest text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={busy || code.replace(/\D/g, "").length < 6}
            className="inline-flex h-10 items-center rounded-(--radius-control) bg-accent-deep px-4 text-sm font-semibold text-on-accent hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create passkey
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setError(null);
          }}
          className="mt-3 text-xs text-accent hover:underline"
        >
          Add a passkey
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
