// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

import type { GuideContent } from "../../docs-ui";

const TXN_FLOW = `draft ──post──▶ posted ──reverse──▶ reversed
  │
  └─discard─▶ discarded   (terminal)`;

const REVERSAL_STATE = `GET /v1/transactions/{id}

{ "status": "posted",
  "reversal": { "effective_status": "partially_reversed",
                "reversed_amount": { "asset": "USD", "amount": "4000" } } }`;

export const GUIDE: GuideContent = {
  es: {
    badge: "Guía · Estados",
    title: "Estados: qué puede pasarle a cada objeto",
    subtitle:
      "Cada objeto del ledger tiene un ciclo de vida corto y explícito. Casi todos solo avanzan: lo que ya ocurrió se corrige con otro asiento, no volviendo atrás.",
    backLabel: "Docs",
    copy: "Copiar",
    copied: "Copiado",
    sections: [
      {
        title: "Transacciones",
        body: "draft y discarded son preparación, no hechos financieros: solo posted y reversed cuentan en saldos, estados de cuenta y balance de comprobación. Una transacción posteada no se edita; se revierte.",
        blocks: [
          { kind: "resp", label: "Ciclo de vida", code: TXN_FLOW },
          {
            kind: "list",
            items: [
              "draft → posted (POST /v1/transactions/{id}/post) o → discarded (…/discard). Un draft no recibe número de diario ni entra en la cadena de hash.",
              "posted → reversed al revertirla por completo. Una reversa parcial (amount) deja el original posted hasta que las reversas vigentes lo cubren todo.",
              "El estado efectivo de las reversas está en GET /v1/transactions/{id}, campo reversal.effective_status: posted, partially_reversed o reversed. Revertir una reversa (una disputa ganada) devuelve el dinero pero deja el original en reversed; reversal dice cómo está de verdad.",
            ],
          },
          { kind: "resp", label: "Estado efectivo", code: REVERSAL_STATE },
        ],
      },
      {
        title: "Cuentas y holds",
        blocks: [
          {
            kind: "table",
            head: ["Objeto", "Estados", "Qué significa"],
            rows: [
              ["Cuenta", "active · frozen · closed", "Solo active acepta movimientos. frozen se aplica con modo all, debits o credits (POST /v1/accounts/{id}/freeze) y se levanta con unfreeze; closed es final."],
              ["Hold", "active · captured · released · expired", "active reserva fondos. captured, released y expired son finales; uno vencido ya no se puede capturar ni liberar (hold_expired)."],
            ],
          },
        ],
      },
      {
        title: "Movimientos",
        body: "Un movimiento es una operación tuya por etapas (una remesa, una nómina). Solo avanza: open → authorized → captured → dispatched, pudiendo saltar etapas, hasta un estado final.",
        blocks: [
          {
            kind: "list",
            items: [
              "Finales: completed (necesita haber llegado a captured), failed o cancelled. Cerrar libera los holds activos y registra el tránsito que quede como transit_residual.",
              "Una etapa que el movimiento ya pasó es 409 movement_stage_invalid; escribir en uno terminado es 409 movement_closed.",
              "Una devolución (reembolso, contracargo) es otro movimiento con parent_movement_id apuntando a uno completed.",
            ],
          },
        ],
      },
      {
        title: "Periodos y ajustes",
        blocks: [
          {
            kind: "table",
            head: ["Objeto", "Estados", "Reglas"],
            rows: [
              ["Periodo", "open → soft_closed → hard_closed", "Solo avanza (volver atrás es 409). soft_closed acepta únicamente ajustes de ese periodo; hard_closed no acepta nada (period_closed)."],
              ["Solicitud de ajuste", "pending → approved → executed (o rejected, cancelled)", "Dos aprobaciones de personas distintas de quien la creó; ejecutar escribe la transacción una sola vez."],
            ],
          },
        ],
      },
      {
        title: "Webhooks y cuentas de la plataforma",
        blocks: [
          {
            kind: "table",
            head: ["Objeto", "Estados", "Reglas"],
            rows: [
              ["Entrega de webhook", "pending → delivered · failed → dead", "Los fallos se reintentan con espera creciente; tras 5 intentos queda dead. Un reintento manual vuelve a failed/dead a pending."],
              ["Cuenta de la plataforma", "registered → email_verified → mfa_enrolled → sandbox → under_review → approved (o rejected / suspended)", "Sandbox desde que verificas correo, autenticador y teléfono; live solo cuando LedgerCore aprueba la cuenta."],
            ],
          },
        ],
      },
    ],
  },
  en: {
    badge: "Guide · Statuses",
    title: "Statuses: what can happen to each object",
    subtitle:
      "Every ledger object has a short, explicit lifecycle. Almost all of them only move forward: what already happened is corrected with another entry, not by going back.",
    backLabel: "Docs",
    copy: "Copy",
    copied: "Copied",
    sections: [
      {
        title: "Transactions",
        body: "draft and discarded are staging, not financial facts: only posted and reversed count in balances, statements and the trial balance. A posted transaction is not edited; it is reversed.",
        blocks: [
          { kind: "resp", label: "Lifecycle", code: TXN_FLOW },
          {
            kind: "list",
            items: [
              "draft → posted (POST /v1/transactions/{id}/post) or → discarded (…/discard). A draft gets no journal number and never enters the hash chain.",
              "posted → reversed when it is reversed in full. A partial reversal (amount) leaves the original posted until the reversals in force cover all of it.",
              "The effective state of the reversals is on GET /v1/transactions/{id}, field reversal.effective_status: posted, partially_reversed or reversed. Reversing a reversal (a dispute won) gives the money back but leaves the original reversed; reversal tells you how it really stands.",
            ],
          },
          { kind: "resp", label: "Effective state", code: REVERSAL_STATE },
        ],
      },
      {
        title: "Accounts and holds",
        blocks: [
          {
            kind: "table",
            head: ["Object", "Statuses", "Meaning"],
            rows: [
              ["Account", "active · frozen · closed", "Only active takes movements. frozen comes with mode all, debits or credits (POST /v1/accounts/{id}/freeze) and is lifted with unfreeze; closed is final."],
              ["Hold", "active · captured · released · expired", "active reserves funds. captured, released and expired are final; an expired one can be neither captured nor released (hold_expired)."],
            ],
          },
        ],
      },
      {
        title: "Movements",
        body: "A movement is an operation of yours in stages (a remittance, a payroll run). It only moves forward: open → authorized → captured → dispatched, stages may be skipped, until a final status.",
        blocks: [
          {
            kind: "list",
            items: [
              "Final: completed (it must have reached captured), failed or cancelled. Closing releases the active holds and records any transit left as transit_residual.",
              "A stage the movement has already passed is 409 movement_stage_invalid; writing to an ended one is 409 movement_closed.",
              "A return (refund, chargeback) is another movement with parent_movement_id pointing at a completed one.",
            ],
          },
        ],
      },
      {
        title: "Periods and adjustments",
        blocks: [
          {
            kind: "table",
            head: ["Object", "Statuses", "Rules"],
            rows: [
              ["Period", "open → soft_closed → hard_closed", "Only moves forward (going back is 409). soft_closed accepts only adjustments of that period; hard_closed accepts nothing (period_closed)."],
              ["Adjustment request", "pending → approved → executed (or rejected, cancelled)", "Two approvals from people other than its maker; executing writes the transaction exactly once."],
            ],
          },
        ],
      },
      {
        title: "Webhooks and platform accounts",
        blocks: [
          {
            kind: "table",
            head: ["Object", "Statuses", "Rules"],
            rows: [
              ["Webhook delivery", "pending → delivered · failed → dead", "Failures retry with growing waits; after 5 attempts it is dead. A manual retry moves failed/dead back to pending."],
              ["Platform account", "registered → email_verified → mfa_enrolled → sandbox → under_review → approved (or rejected / suspended)", "Sandbox once email, authenticator and phone are verified; live only when LedgerCore approves the account."],
            ],
          },
        ],
      },
    ],
  },
};
