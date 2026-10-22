// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

/**
 * Integration credentials (7.9): SMTP, SMS and IP-info keys, per environment.
 * The API never returns a secret, so this panel only shows whether a key is
 * configured, where it comes from and who rotated it. A secret is typed into a
 * password field, sent once and cleared; it is never rendered back.
 */

import { useCallback, useEffect, useState } from "react";
import { ErrorNote, InfoNote } from "@/components/auth-shell";
import { useLang } from "@/components/language";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteIntegrationSecret,
  type Integration,
  type IntegrationKey,
  listIntegrations,
  setIntegrationSecret,
} from "@/lib/backoffice";
import { IdentityError } from "@/lib/session";

const TEXT = {
  en: {
    intro:
      "Credentials of the services LedgerCore uses to reach people. Values are sealed when saved and are never shown again; you can only replace or remove them.",
    loading: "Loading…",
    ready: "ready",
    notReady: "incomplete",
    required: "required",
    optional: "optional",
    configured: "configured",
    missing: "missing",
    database: "stored here",
    environment: "from server environment",
    rotated: "Rotated",
    by: "by",
    placeholder: "New value",
    save: "Save",
    rotate: "Replace",
    remove: "Remove",
    confirmRemove: "Remove from the database? The environment value, if any, applies again.",
    confirm: "Confirm",
    cancel: "Cancel",
    saved: "Saved.",
    removed: "Removed.",
    noMasterKey: "The service has no master key configured, so it cannot store secrets.",
    forbidden: "Only platform operators can manage integrations.",
    error: "Something went wrong. Try again.",
  },
  es: {
    intro:
      "Credenciales de los servicios con los que LedgerCore llega a las personas. Los valores se sellan al guardar y no se vuelven a mostrar; solo se pueden reemplazar o quitar.",
    loading: "Cargando…",
    ready: "lista",
    notReady: "incompleta",
    required: "obligatoria",
    optional: "opcional",
    configured: "configurada",
    missing: "falta",
    database: "guardada aquí",
    environment: "del entorno del servidor",
    rotated: "Rotada",
    by: "por",
    placeholder: "Valor nuevo",
    save: "Guardar",
    rotate: "Reemplazar",
    remove: "Quitar",
    confirmRemove: "¿Quitarla de la base de datos? Si hay un valor en el entorno, vuelve a aplicar.",
    confirm: "Confirmar",
    cancel: "Cancelar",
    saved: "Guardada.",
    removed: "Quitada.",
    noMasterKey: "El servicio no tiene llave maestra configurada, así que no puede guardar secretos.",
    forbidden: "Solo los operadores de la plataforma administran las integraciones.",
    error: "Algo salió mal. Inténtalo de nuevo.",
  },
} as const;

type Strings = (typeof TEXT)[keyof typeof TEXT];

function KeyRow({
  integration,
  k,
  s,
  lang,
  onChanged,
  onError,
}: {
  integration: Integration;
  k: IntegrationKey;
  s: Strings;
  lang: string;
  onChanged: (msg: string) => void;
  onError: (e: unknown) => void;
}) {
  const [secret, setSecret] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await setIntegrationSecret(integration, k.name, secret);
      setSecret("");
      onChanged(s.saved);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteIntegrationSecret(integration, k.name);
      setConfirmingRemove(false);
      onChanged(s.removed);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 border-t border-edge py-3 text-xs sm:grid-cols-[12rem_1fr_auto] sm:items-center">
      <div>
        <p className="font-mono text-ink">{k.name}</p>
        <p className="text-ink-faint">{k.required ? s.required : s.optional}</p>
      </div>
      <div className="space-y-1">
        <Badge tone={k.configured ? "emerald" : k.required ? "red" : "slate"} dot>
          {k.configured ? s.configured : s.missing}
        </Badge>
        {k.configured && k.source && (
          <span className="ml-2 text-ink-faint">
            {k.source === "database" ? s.database : s.environment}
          </span>
        )}
        {k.rotated_at && (
          <p className="text-ink-faint">
            {s.rotated} {new Date(k.rotated_at).toLocaleString(lang)}
            {k.rotated_by ? ` ${s.by} ${k.rotated_by}` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={secret}
          maxLength={4096}
          placeholder={s.placeholder}
          aria-label={`${integration.provider} ${integration.environment} ${k.name}`}
          onChange={(e) => setSecret(e.target.value)}
          className="h-8 w-44 rounded-(--radius-control) border border-edge-strong bg-surface px-2 text-xs text-ink"
        />
        <Button size="sm" disabled={busy || secret === ""} onClick={() => void save()}>
          {k.source === "database" ? s.rotate : s.save}
        </Button>
        {k.source === "database" &&
          (confirmingRemove ? (
            <>
              <span className="max-w-48 text-[11px] text-ink">{s.confirmRemove}</span>
              <Button size="sm" disabled={busy} onClick={() => void remove()}>
                {s.confirm}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(false)}>
                {s.cancel}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(true)}>
              {s.remove}
            </Button>
          ))}
      </div>
    </li>
  );
}

export function IntegrationsPanel() {
  const { lang } = useLang();
  const s: Strings = lang === "es" ? TEXT.es : TEXT.en;
  const [list, setList] = useState<Integration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof IdentityError && e.status === 503) setError(s.noMasterKey);
      else if (e instanceof IdentityError && e.status === 403) setError(s.forbidden);
      else setError(s.error);
    },
    [s],
  );

  const load = useCallback(async () => {
    try {
      setList(await listIntegrations());
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-muted">{s.intro}</p>
      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && <InfoNote>{notice}</InfoNote>}
      {!list && !error && (
        <p role="status" className="text-xs text-ink-muted">
          {s.loading}
        </p>
      )}
      {list?.map((i) => (
        <section
          key={`${i.provider}/${i.environment}`}
          className="rounded-(--radius-card) border border-edge bg-surface/80 px-5 py-4"
        >
          <header className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">{i.provider.toUpperCase()}</h2>
            <Badge tone={i.environment === "live" ? "emerald" : "violet"}>{i.environment}</Badge>
            <Badge tone={i.ready ? "emerald" : "amber"} dot>
              {i.ready ? s.ready : s.notReady}
            </Badge>
          </header>
          <ul>
            {i.keys.map((k) => (
              <KeyRow
                key={k.name}
                integration={i}
                k={k}
                s={s}
                lang={lang}
                onError={fail}
                onChanged={(msg) => {
                  setError(null);
                  setNotice(msg);
                  void load();
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
