// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

"use client";

import { BookOpenText, CornerDownRight, FileText, FolderTree } from "lucide-react";
import { useState } from "react";
import { ErrorLine, Field, inputClass, Notice } from "@/components/form";
import { LedgerTools } from "@/components/ledger-tools";
import { Button } from "@/components/ui/button";
import { StatementDrawer } from "@/components/statement-drawer";
import { DemoBadge } from "@/components/demo-badge";
import {
  ApiDownBanner,
  EmptyState,
  ErrorBanner,
  LoadingCard,
  useLiveData,
} from "@/components/live";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoneyWithAsset } from "@/lib/format";
import { apiErrorText, createLedger, loadLedgersTree, type LedgerWithAccounts } from "@/lib/live";
import { mockLedgers } from "@/lib/mock-data";

const CREATE_LEDGER_CURL = `curl -s -X POST $API/v1/ledgers \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "main", "description": "Primary operating ledger" }'`;

interface DisplayBalance {
  asset: string;
  exponent: number;
  units: bigint;
}

interface TreeNode {
  name: string;
  fullPath: string;
  balances: DisplayBalance[] | null;
  status?: string;
  /** Real account id (live data only) — enables the Statement drawer. */
  accountId?: string;
  children: TreeNode[];
}

interface AccountRow {
  name: string;
  balances: DisplayBalance[];
  status?: string;
  accountId?: string;
}

/**
 * Builds a nested tree out of flat account names. Live accounts follow the
 * colon-namespaced convention (customer:cust_42:wallet); the demo dataset
 * uses slash-separated paths. Both are treated as segment separators.
 */
function buildTree(accounts: AccountRow[]): TreeNode[] {
  const roots: TreeNode[] = [];
  for (const account of accounts) {
    const segments = account.name.split(/[:/]/).filter(Boolean);
    let level = roots;
    let prefix = "";
    segments.forEach((segment, index) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      let node = level.find((candidate) => candidate.name === segment);
      if (!node) {
        node = { name: segment, fullPath: prefix, balances: null, children: [] };
        level.push(node);
      }
      if (index === segments.length - 1) {
        node.balances = account.balances;
        node.status = account.status;
        node.accountId = account.accountId;
      }
      level = node.children;
    });
  }
  return roots;
}

function TreeBranch({
  node,
  depth,
  onStatement,
}: {
  node: TreeNode;
  depth: number;
  onStatement?: (accountId: string, name: string) => void;
}) {
  return (
    <li>
      <div
        className="flex items-center justify-between gap-4 border-b border-edge py-2.5 last:border-b-0"
        style={{ paddingLeft: `${depth * 1.5}rem` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {depth > 0 && (
            <CornerDownRight
              size={13}
              className="shrink-0 text-ink-faint"
              aria-hidden="true"
            />
          )}
          {node.balances ? (
            <span className="truncate font-mono text-[13px] text-ink">
              {node.name}
            </span>
          ) : (
            <span className="truncate text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
              {node.name}
            </span>
          )}
          {node.status && node.status !== "active" && (
            <Badge tone="amber">{node.status}</Badge>
          )}
        </div>
        {node.balances && (
          <div className="flex shrink-0 items-center gap-3">
            {node.accountId && onStatement && (
              <button
                type="button"
                onClick={() => onStatement(node.accountId!, node.fullPath)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-(--radius-control) border border-edge-strong px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent/60 hover:text-accent"
              >
                <FileText size={11} aria-hidden="true" />
                Statement
              </button>
            )}
            <div className="flex flex-col items-end gap-0.5">
            {node.balances.length === 0 && (
              <span className="text-xs text-ink-faint">no activity</span>
            )}
            {node.balances.map((balance) => (
              <span
                key={balance.asset}
                className="num text-[13px] font-medium text-ink"
              >
                {formatMoneyWithAsset(balance.units, balance.asset, balance.exponent)}
              </span>
            ))}
            </div>
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeBranch
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              onStatement={onStatement}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LedgerCard({
  name,
  description,
  environment,
  accounts,
  onStatement,
}: {
  name: string;
  description: string;
  environment?: string;
  accounts: AccountRow[];
  onStatement?: (accountId: string, name: string) => void;
}) {
  return (
    <Card
      title={name}
      subtitle={description}
      actions={
        <span className="flex items-center gap-2">
          {environment && (
            <Badge tone={environment === "live" ? "emerald" : "violet"}>
              {environment}
            </Badge>
          )}
          <Badge tone="slate" className="gap-1">
            <FolderTree size={11} aria-hidden="true" />
            {accounts.length} accounts
          </Badge>
        </span>
      }
    >
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <BookOpenText size={22} className="text-ink-faint" aria-hidden="true" />
          <p className="text-sm text-ink-muted">
            This ledger has no accounts yet. Create them with{" "}
            <code className="font-mono text-xs text-accent">POST /v1/accounts</code>{" "}
            (guide at{" "}
            <a href="/docs/quickstart" className="text-accent hover:underline">
              /docs/quickstart
            </a>
            ).
          </p>
        </div>
      ) : (
        <ul>
          {buildTree(accounts).map((node) => (
            <TreeBranch
              key={node.fullPath}
              node={node}
              depth={0}
              onStatement={onStatement}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function NewLedger({ onCreated }: { onCreated: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        New ledger
      </Button>
    );
  return (
    <Card title="New ledger" subtitle="An isolated book of accounts. Its environment follows your session.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputClass} value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description (optional)">
          <input className={inputClass} value={description} maxLength={1024} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <ErrorLine message={error} />
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          disabled={busy || name.trim() === ""}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const l = await createLedger({
                name: name.trim(),
                ...(description.trim() ? { description: description.trim() } : {}),
              });
              onCreated(l.name);
            } catch (e) {
              setError(apiErrorText(e));
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating…" : "Create ledger"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function LiveLedgers({
  data,
  reload,
  onNotice,
}: {
  data: LedgerWithAccounts[];
  reload: () => void;
  onNotice: (m: string) => void;
}) {
  const [statementFor, setStatementFor] = useState<{
    accountId: string;
    name: string;
  } | null>(null);
  if (data.length === 0) {
    return (
      <>
      <NewLedger onCreated={() => reload()} />
      <EmptyState
        title="No ledgers in this tenant yet"
        body="A ledger is an isolated book of accounts with its own account tree. Create the first one with this curl and reload."
        curl={CREATE_LEDGER_CURL}
        curlLabel="POST /v1/ledgers"
      />
      </>
    );
  }
  return (
    <>
      <NewLedger
        onCreated={(n) => {
          onNotice(`Created ledger ${n}.`);
          reload();
        }}
      />
      {data.map(({ ledger, accounts }) => (
        <div key={ledger.id} className="space-y-3">
        <LedgerCard
          name={ledger.name}
          description={ledger.description ?? ""}
          environment={ledger.environment}
          onStatement={(accountId, name) => setStatementFor({ accountId, name })}
          accounts={accounts.map(({ account, balances }) => ({
            name: account.name,
            status: account.status,
            accountId: account.id,
            balances: balances.map((b) => ({
              asset: b.asset,
              exponent: b.exponent,
              units: BigInt(b.posted),
            })),
          }))}
        />
        <LedgerTools
          ledger={ledger}
          onChanged={(m) => {
            onNotice(m);
            reload();
          }}
        />
        </div>
      ))}
      {statementFor && (
        <StatementDrawer
          accountId={statementFor.accountId}
          accountName={statementFor.name}
          onClose={() => setStatementFor(null)}
        />
      )}
    </>
  );
}

function DemoLedgers() {
  return (
    <>
      {mockLedgers.map((ledger) => (
        <LedgerCard
          key={ledger.id}
          name={ledger.name}
          description={ledger.description}
          accounts={ledger.accounts.map((account) => ({
            name: account.path,
            balances: account.balances.map((b) => ({
              asset: b.asset,
              exponent: b.exponent,
              units: BigInt(Math.trunc(b.units)),
            })),
          }))}
        />
      ))}
    </>
  );
}

export function LedgersView() {
  const state = useLiveData(loadLedgersTree);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink">
            Ledgers
          </h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Ledgers and their account trees with balances per asset
          </p>
        </div>
        <DemoBadge demo={state.status === "demo"} />
      </div>

      <Notice message={notice} />
      {state.status === "loading" && <LoadingCard orb="solving" />}
      {state.status === "demo" && <DemoLedgers />}
      {state.status === "down" && <ApiDownBanner onRetry={state.reload} />}
      {state.status === "error" && (
        <ErrorBanner message={state.message} onRetry={state.reload} />
      )}
      {state.status === "live" && <LiveLedgers data={state.data} reload={state.reload} onNotice={setNotice} />}
    </div>
  );
}
