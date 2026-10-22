// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { GuideContent } from "../../docs-ui";

const ENV_ERR = `HTTP/2 403
{ "error": { "code": "environment_mismatch",
             "message": "…", "request_id": "…" } }`;

export const GUIDE: GuideContent = {
  es: {
    badge: "Guía · Sandbox",
    title: "Sandbox: practica con dinero de mentira",
    subtitle:
      "El sandbox es un ambiente aparte con la misma API. Te permite integrar y probar de punta a punta sin riesgo; pasar a producción es cambiar de credencial, no de código.",
    backLabel: "Docs",
    copy: "Copiar",
    copied: "Copiado",
    sections: [
      {
        title: "Cómo obtener un sandbox",
        body: "Regístrate en /register: con correo, autenticador y teléfono verificados obtienes credenciales sandbox desde la consola (Developers). El secreto de una credencial se muestra una sola vez al crearla; guárdalo, no se vuelve a mostrar. En /signup hay además un alta rápida de sandbox que te devuelve una API key.",
      },
      {
        title: "Qué es y qué no es",
        blocks: [
          {
            kind: "list",
            items: [
              "Es la misma API, los mismos contratos y los mismos errores que producción; lo que pruebes aquí se comporta igual allá.",
              "Es un ambiente separado: sus datos nunca se mezclan con los de producción, y una credencial sandbox es rechazada por producción (y al revés) con 403 environment_mismatch.",
              "Un sandbox por correo, con cupos de uso (también un cupo diario de altas): pasarte devuelve 429 rate_limited con Retry-After.",
              "Es temporal: el tenant sandbox y todos sus datos se eliminan automáticamente a los 14 días. No guardes nada que quieras conservar.",
              "No mueve dinero real. Los webhooks sí se entregan a la URL que registres, así que usa un endpoint de pruebas.",
            ],
          },
          { kind: "resp", label: "Credencial de otro ambiente", code: ENV_ERR },
        ],
      },
      {
        title: "Pasar a producción",
        body: "Las credenciales live solo existen cuando LedgerCore aprueba tu cuenta en su back office (verificación antes de operar). Una vez aprobada, creas credenciales live en la consola, apuntas tu cliente a la URL de producción y no cambias nada más: mismo flujo de firma, misma idempotencia, mismos estados.",
      },
    ],
  },
  en: {
    badge: "Guide · Sandbox",
    title: "Sandbox: practice with play money",
    subtitle:
      "The sandbox is a separate environment with the same API. It lets you integrate and test end to end at no risk; going live is changing credentials, not code.",
    backLabel: "Docs",
    copy: "Copy",
    copied: "Copied",
    sections: [
      {
        title: "Getting a sandbox",
        body: "Sign up at /register: with email, authenticator and phone verified you get sandbox credentials from the console (Developers). A credential's secret is shown exactly once, when you create it; save it, it is not shown again. /signup also offers a quick sandbox signup that returns an API key.",
      },
      {
        title: "What it is and is not",
        blocks: [
          {
            kind: "list",
            items: [
              "It is the same API, the same contracts and the same errors as production; what you test here behaves the same there.",
              "It is a separate environment: its data never mixes with production's, and a sandbox credential is refused by production (and the other way round) with 403 environment_mismatch.",
              "One sandbox per email, with usage quotas (also a daily signup quota): going over returns 429 rate_limited with Retry-After.",
              "It is temporary: the sandbox tenant and all its data are deleted automatically after 14 days. Do not keep anything there you want to keep.",
              "It moves no real money. Webhooks are delivered to the URL you register, so use a test endpoint.",
            ],
          },
          { kind: "resp", label: "Credential from another environment", code: ENV_ERR },
        ],
      },
      {
        title: "Going to production",
        body: "Live credentials exist only once LedgerCore approves your account in its back office (verification before operating). Once approved, you create live credentials in the console, point your client at the production URL and change nothing else: same signing flow, same idempotency, same statuses.",
      },
    ],
  },
};
