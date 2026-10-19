// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { GuideContent } from "../../docs-ui";

const ERROR_SHAPE = `{
  "error": {
    "code": "validation_failed",
    "message": "explicación legible; nunca la parsees",
    "request_id": "9f1b2c3d4e5f60718293a4b5c6d7e8f9"
  }
}`;

const TS_ERRORS = `import { LedgerCore, LedgerCoreError, ERROR_CODES } from "@ledgercore/sdk";

try {
  await lc.transactions.create({ ledger_id, postings });
} catch (e) {
  if (e instanceof LedgerCoreError) {
    // Ramifica SOLO por e.code (estable); e.message puede cambiar sin aviso.
    switch (e.code) {
      case "unbalanced_transaction": /* corrige los montos */ break;
      case "rate_limited":           /* backoff + retry misma key */ break;
      default: console.error(e.status, e.code, e.requestId);
    }
  }
  // Credenciales rechazadas → AuthenticationError; red caída → ConnectionError
}`;

const PHP_ERRORS = `use LedgerCore\\ErrorCode;
use LedgerCore\\Exception\\LedgerCoreException;

try {
    $lc->transactions->create([...]);
} catch (LedgerCoreException $e) {
    // Ramifica SOLO por errorCode (estable); message puede cambiar sin aviso.
    match ($e->errorCode) {
        ErrorCode::UNBALANCED_TRANSACTION => corregirMontos(),
        ErrorCode::RATE_LIMITED           => reintentarConBackoff(),
        default => log_error($e->status, $e->errorCode, $e->requestId),
    };
}
// Credenciales rechazadas → AuthenticationException; red → ConnectionException`;

// Shared catalog rows (code + HTTP are language-neutral)
const CATALOG_ES: string[][] = [
  ["validation_failed", "400", "Entrada malformada o semánticamente inválida (JSON inválido, campo desconocido, UUID mal formado, límite no numérico…).", "Corrige el request; no reintentes sin cambiarlo."],
  ["invalid_cursor", "400", "El ?cursor= no es un cursor emitido por la API.", "Usa el next_cursor literal de la página anterior; si lo perdiste, reinicia desde la primera página."],
  ["unauthorized", "401", "Credenciales ausentes o inválidas: token faltante/expirado, API key desconocida o revocada.", "Renueva el token (los SDKs lo hacen solos y reintentan una vez). Si persiste, revisa la API key."],
  ["forbidden", "403", "Autenticado pero sin permiso para la operación (reservado; hoy los scopes se validan de forma binaria en el gateway).", "Revisa los scopes de tu llave."],
  ["not_found", "404", "El recurso no existe dentro de tu tenant.", "Verifica el id y que pertenezca al tenant/entorno correcto (sandbox vs live)."],
  ["conflict", "409", "Conflicto de unicidad (slug/nombre duplicado) o de estado del ciclo de vida (postear una transacción revertida o descartada, descartar una transacción posteada, reintentar una entrega no reintentable, cambiar una cuenta cerrada, cerrar una cuenta con saldo, holds o drafts pendientes).", "Lee el recurso actual y decide; no es un error transitorio."],
  ["idempotency_conflict", "409", "Reservado: misma idempotency key con payload distinto. Hoy la reutilización devuelve la respuesta original con X-Idempotent-Replay: true.", "Nunca reutilices una key con contenido distinto."],
  ["unbalanced_transaction", "422", "Los apuntes no cuadran por activo (débitos ≠ créditos) o hay overflow monetario.", "Corrige los montos hasta que débitos = créditos por asset."],
  ["insufficient_funds", "422", "El saldo disponible no cubre la operación: un hold, o un asiento que dejaría en negativo una cuenta con allow_negative: false (wallets/pasivos por defecto).", "Reduce el monto o libera holds; reintenta cuando haya saldo."],
  ["account_inactive", "422", "La transacción o el hold toca una cuenta frozen o closed.", "No es transitorio: reactiva la cuenta o usa otra."],
  ["account_not_postable", "422", "La transacción o el hold toca una cuenta padre: hay otras cuentas bajo su nombre (assets → assets:cash). Su saldo es el agregado de sus hijas.", "No es transitorio: postea a una cuenta hoja."],
  ["parent_account_has_activity", "422", "Al crear una cuenta, su nombre la pone bajo una cuenta que ya tiene apuntes o holds activos; esa cuenta quedaría como padre y no podría mover esos fondos.", "Crea la cuenta en otro nivel (p. ej. una hermana) o usa una cuenta nueva como padre."],
  ["period_closed", "422", "La fecha efectiva de la transacción cae en un periodo contable cerrado: hard_closed no acepta nada; soft_closed solo ajustes de ese periodo (adjusts_period_id).", "No es transitorio: registra un ajuste fechado en un periodo abierto con adjusts_period_id apuntando al periodo cerrado."],
  ["approval_required", "422", "Un ajuste (adjusts_period_id) enviado a POST /v1/transactions: los ajustes solo se escriben ejecutando una solicitud aprobada por dos personas distintas de quien la creó.", "Crea una solicitud en POST /v1/adjustment-requests, consigue dos aprobaciones y ejecútala."],
  ["self_approval", "403", "Quien creó la solicitud de ajuste intentó aprobarla.", "La aprueban otras dos identidades (API keys) distintas del autor."],
  ["request_hash_mismatch", "409", "La aprobación nombra un request_hash distinto al de la solicitud.", "Relee la solicitud (GET /v1/adjustment-requests/{id}), revísala y aprueba su request_hash actual."],
  ["metadata_not_scalar", "422", "Un valor de metadata es un objeto, un array o null.", "Aplana la metadata: solo strings, números o booleanos."],
  ["metadata_too_large", "422", "Más de 50 claves, una clave vacía o de más de 64 bytes, o un valor de más de 500 bytes.", "Recorta la metadata; guarda lo voluminoso en tu sistema y referencia su id."],
  ["metadata_pii_detected", "422", "Una clave o un valor parece un email, una tarjeta, un teléfono o un IBAN. El mensaje nunca repite el valor.", "No guardes datos personales en metadata; usa ids opacos con prefijo (cus_42, ord_…)."],
  ["metadata_key_not_allowed", "422", "La clave no está en la lista blanca de metadata del libro.", "Usa una clave permitida o pide ampliar la lista (PUT /v1/ledgers/{id}/metadata-policy)."],
  ["rate_limited", "429", "Se superó un límite de uso (p. ej. cupo diario de signups sandbox).", "Espera y reintenta con backoff; con la misma idempotency key el retry es seguro."],
  ["internal", "500", "Error inesperado; el detalle sólo está en los logs del servicio.", "Reintenta con backoff; si persiste, reporta el request_id a soporte."],
  ["service_unavailable", "503", "Dependencia caída (base de datos) o funcionalidad no configurada (admin token ausente).", "Reintenta con backoff."],
];

const CATALOG_EN: string[][] = [
  ["validation_failed", "400", "Malformed or semantically invalid input (bad JSON, unknown field, malformed UUID, non-numeric limit…).", "Fix the request; don't retry unchanged."],
  ["invalid_cursor", "400", "The ?cursor= is not a cursor issued by the API.", "Use the previous page's next_cursor verbatim; if lost, restart from the first page."],
  ["unauthorized", "401", "Missing or invalid credentials: missing/expired token, unknown or revoked API key.", "Refresh the token (the SDKs do it and retry once). If it persists, check the API key."],
  ["forbidden", "403", "Authenticated but not allowed (reserved; today scopes are validated binarily at the gateway).", "Review your key's scopes."],
  ["not_found", "404", "The resource does not exist within your tenant.", "Check the id and that it belongs to the right tenant/environment (sandbox vs live)."],
  ["conflict", "409", "Uniqueness conflict (duplicate slug/name) or lifecycle conflict (posting a reversed or discarded transaction, discarding a posted transaction, retrying a non-retryable delivery, changing a closed account, closing an account with a balance, holds or pending drafts).", "Read the current resource and decide; it is not transient."],
  ["idempotency_conflict", "409", "Reserved: same idempotency key with a different payload. Today reuse returns the original response with X-Idempotent-Replay: true.", "Never reuse a key with different content."],
  ["unbalanced_transaction", "422", "Postings don't balance per asset (debits ≠ credits) or a monetary overflow occurred.", "Fix the amounts until debits = credits per asset."],
  ["insufficient_funds", "422", "Available balance does not cover the operation: a hold, or a posting that would leave an account with allow_negative: false below zero (wallets/liabilities by default).", "Lower the amount or release holds; retry once funded."],
  ["account_inactive", "422", "The transaction or hold touches a frozen or closed account.", "Not transient: reactivate the account or use another one."],
  ["account_not_postable", "422", "The transaction or hold touches a parent account: other accounts live under its name (assets → assets:cash). Its balance is the sum of its children.", "Not transient: post to a leaf account."],
  ["parent_account_has_activity", "422", "When creating an account, its name puts it under an account that already has postings or active holds; that account would become a parent and could never move those funds.", "Create the account at another level (e.g. as a sibling) or use a new account as the parent."],
  ["period_closed", "422", "The transaction's effective date falls in a closed accounting period: hard_closed accepts nothing; soft_closed only adjustments of that period (adjusts_period_id).", "Not transient: post an adjustment dated in an open period with adjusts_period_id naming the closed one."],
  ["approval_required", "422", "An adjustment (adjusts_period_id) sent to POST /v1/transactions: adjustments are only written by executing a request two people other than its maker approved.", "Create a request with POST /v1/adjustment-requests, get two approvals and execute it."],
  ["self_approval", "403", "The maker of an adjustment request tried to approve it.", "Two other identities (API keys) approve it."],
  ["request_hash_mismatch", "409", "The approval names a request_hash other than the request's.", "Re-read the request (GET /v1/adjustment-requests/{id}), review it and approve its current request_hash."],
  ["metadata_not_scalar", "422", "A metadata value is an object, an array or null.", "Flatten the metadata: strings, numbers or booleans only."],
  ["metadata_too_large", "422", "Over 50 keys, an empty key or one over 64 bytes, or a value over 500 bytes.", "Trim the metadata; keep bulky data in your system and reference its id."],
  ["metadata_pii_detected", "422", "A key or value looks like an email, card number, phone number or IBAN. The message never echoes the value.", "Don't store personal data in metadata; use opaque prefixed ids (cus_42, ord_…)."],
  ["metadata_key_not_allowed", "422", "The key is not in the ledger's metadata allowlist.", "Use an allowed key or have the list extended (PUT /v1/ledgers/{id}/metadata-policy)."],
  ["rate_limited", "429", "A usage limit was exceeded (e.g. daily sandbox signup quota).", "Wait and retry with backoff; with the same idempotency key the retry is safe."],
  ["internal", "500", "Unexpected error; details live only in the service logs.", "Retry with backoff; if it persists, report the request_id to support."],
  ["service_unavailable", "503", "Dependency down (database) or feature not configured (missing admin token).", "Retry with backoff."],
];

export const GUIDE: GuideContent = {
  es: {
    badge: "Guía · Errores",
    title: "Errores: un formato, un catálogo estable",
    subtitle:
      "Los cuatro servicios devuelven los errores 4xx/5xx con el mismo formato. El code en snake_case es la ÚNICA parte sobre la que un cliente debe ramificar: los códigos son un contrato — no se renombran ni se eliminan.",
    backLabel: "Docs",
    copy: "Copiar",
    copied: "Copiado",
    sections: [
      {
        title: "El formato único",
        blocks: [
          { kind: "resp", label: "Todo error 4xx/5xx", code: ERROR_SHAPE },
          {
            kind: "list",
            items: [
              "code: código estable en snake_case. Lo único sobre lo que debes ramificar.",
              "message: texto para humanos. Puede cambiar sin aviso — nunca lo parsees.",
              "request_id: id de correlación, siempre presente; es el mismo valor de la cabecera X-Request-Id. Inclúyelo en cualquier reporte de soporte.",
              "Ningún error expone detalles internos (SQL, stack traces, rutas): lo inesperado se registra en los logs y al cliente sólo le llega internal.",
            ],
          },
        ],
      },
      {
        title: "Catálogo completo",
        body: "Código → HTTP → cuándo ocurre → qué hacer:",
        blocks: [
          { kind: "table", head: ["Código", "HTTP", "Cuándo ocurre", "Qué hacer"], rows: CATALOG_ES },
        ],
      },
      {
        title: "Manejo en TypeScript",
        body: "Toda respuesta no-2xx lanza LedgerCoreError con status, code y requestId. El catálogo se exporta como ERROR_CODES (tipo ErrorCode).",
        blocks: [{ kind: "code", label: "TypeScript", code: TS_ERRORS }],
      },
      {
        title: "Manejo en PHP",
        body: "Toda respuesta no-2xx lanza LedgerCoreException con status, errorCode y requestId. El catálogo vive en LedgerCore\\ErrorCode (ErrorCode::ALL).",
        blocks: [{ kind: "code", label: "PHP", code: PHP_ERRORS }],
      },
    ],
  },
  en: {
    badge: "Guide · Errors",
    title: "Errors: one shape, one stable catalog",
    subtitle:
      "All four services return 4xx/5xx errors with the same shape. The snake_case code is the ONLY part a client should branch on: codes are a contract — never renamed, never removed.",
    backLabel: "Docs",
    copy: "Copy",
    copied: "Copied",
    sections: [
      {
        title: "The single shape",
        blocks: [
          { kind: "resp", label: "Every 4xx/5xx error", code: ERROR_SHAPE },
          {
            kind: "list",
            items: [
              "code: stable snake_case code. The only thing you should branch on.",
              "message: human-readable text. May change without notice — never parse it.",
              "request_id: correlation id, always present; same value as the X-Request-Id header. Include it in any support report.",
              "No error exposes internals (SQL, stack traces, file paths): unexpected failures are logged server-side and the client only sees internal.",
            ],
          },
        ],
      },
      {
        title: "Full catalog",
        body: "Code → HTTP → when it happens → what to do:",
        blocks: [
          { kind: "table", head: ["Code", "HTTP", "When it happens", "What to do"], rows: CATALOG_EN },
        ],
      },
      {
        title: "Handling in TypeScript",
        body: "Every non-2xx response throws LedgerCoreError with status, code and requestId. The catalog is exported as ERROR_CODES (type ErrorCode).",
        blocks: [{ kind: "code", label: "TypeScript", code: TS_ERRORS }],
      },
      {
        title: "Handling in PHP",
        body: "Every non-2xx response throws LedgerCoreException with status, errorCode and requestId. The catalog lives in LedgerCore\\ErrorCode (ErrorCode::ALL).",
        blocks: [{ kind: "code", label: "PHP", code: PHP_ERRORS }],
      },
    ],
  },
};
