// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

export type Lang = "es" | "en";

export const LANG_STORAGE_KEY = "lc_lang";

/** Detecta el idioma inicial en el navegador: localStorage → navigator.language → EN. */
export function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    /* localStorage bloqueado */
  }
  const nav = window.navigator.language || "";
  return nav.toLowerCase().startsWith("es") ? "es" : "en";
}

/** Para metadata en el servidor a partir del header Accept-Language. */
export function langFromAcceptLanguage(header: string | null): Lang {
  if (!header) return "en";
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("es") ? "es" : "en";
}

const es = {
  meta: {
    title: "LedgerCore — el ledger de doble entrada para fintechs",
    description:
      "Ledger de doble entrada de código fuente disponible: asientos balanceados, historia inmutable, dinero exacto e idempotencia, garantizados por PostgreSQL. Levántalo en local con docker compose.",
  },
  nav: {
    docs: "Docs",
    quickstart: "Quickstart",
    login: "Iniciar sesión",
    trySandbox: "Probar el sandbox",
    ariaLabel: "Principal",
    home: "Inicio",
    homeAriaLabel: "LedgerCore — ir al inicio",
  },
  hero: {
    badge: "Código fuente disponible · FSL-1.1 → Apache-2.0 · pre-1.0",
    titlePre: "El ledger de doble entrada para fintechs que ",
    titleHighlight: "mueven dinero",
    titlePost: "",
    subtitle:
      "¿Dónde está el dinero, a quién pertenece y qué operación explica cada centavo? LedgerCore responde esa pregunta en todo momento, con garantías de base de datos y no con hojas de cálculo.",
    ctaPrimary: "Pruébalo en 1 minuto",
    ctaSecondary: "Ver el código en GitHub",
  },
  bench: {
    items: [
      { value: "~390 tx/s", label: "por ledger, con 8 a 64 clientes concurrentes y cero errores" },
      { value: "~1.170 tx/s", label: "repartiendo la carga entre ledgers (un ledger por worker)" },
      { value: "42 ms", label: "de p99 con 32 workers concurrentes, de punta a punta por HTTP" },
    ],
    foot: "Medido en un laptop (Ryzen 7 7840HS, Docker Desktop, PostgreSQL con la configuración por defecto) contra la API pública. ",
    link: "Metodología y cómo correrlo tú →",
  },
  scenarios: {
    answerLabel: "Qué hace LedgerCore:",
    title: "Cuatro escenarios que ya viviste",
    subtitle:
      "No son casos hipotéticos: son las noches que nos costaron construir esto. Si reconoces alguno, sabes exactamente para qué sirve LedgerCore.",
    items: [
      {
        role: "Finanzas / Cierre de mes",
        title: "El saldo no cuadra y nadie sabe desde cuándo",
        scenario:
          "El total de los wallets dice una cosa, el extracto del banco dice otra. La diferencia lleva semanas ahí y el cierre queda trabado mientras alguien revisa transacción por transacción.",
        answer:
          "Cada saldo es la suma de sus asientos, no una columna que alguien escribe. Puedes recalcularlo a cualquier fecha de corte y ver el punto exacto donde las dos series se separan.",
      },
      {
        role: "Compliance / Auditoría",
        title: "Te piden justificar un movimiento de hace ocho meses",
        scenario:
          "El auditor señala una línea vieja y pregunta qué la originó. El registro se actualizó tres veces desde entonces y el estado anterior no quedó en ningún lado.",
        answer:
          "El ledger es append-only: nada se edita, todo se corrige con un asiento nuevo. Cada centavo conserva su operación de origen y el histórico completo es reconstruible.",
      },
      {
        role: "Ingeniería / Plataforma",
        title: "El reintento acreditó dos veces al mismo cliente",
        scenario:
          "El proveedor no recibió tu 200, reintentó el callback y el depósito entró duplicado. Lo detectas días después, cuando el cliente ya retiró la diferencia.",
        answer:
          "La Idempotency-Key es parte del contrato, no una convención. El segundo POST devuelve la misma transacción en lugar de crear otra — el reintento deja de ser un riesgo.",
      },
      {
        role: "Soporte / Operaciones",
        title: "Hay fondos retenidos sin operación viva detrás",
        scenario:
          "El cliente reclama que su saldo disponible no le alcanza. Hay dinero reservado por una operación que nunca se completó ni se canceló, y liberarlo requiere tocar la base a mano.",
        answer:
          "Los holds son de primera clase: se reservan, expiran y se liberan con el mismo rigor contable que un posteo. El saldo disponible siempre es el posteado menos los holds vigentes, y cada uno es visible con su origen.",
      },
    ],
    footNote:
      "¿Tu escenario no está acá? Abre un issue en GitHub: es exactamente lo que queremos escuchar.",
  },
  how: {
    title: "Una API, asientos siempre balanceados",
    subtitle:
      "Un depósito de USD 100 con fee de 3: un solo POST, tres postings, y el invariante débitos = créditos verificado por el motor.",
    responseNote:
      "10000 = 9700 + 300. Montos en unidades menores (centavos), como enteros. Si no balancea, no se postea.",
    quickstartCta: "Hazlo tú mismo: de 0 a tu primera transacción en 10 minutos →",
  },
  guarantees: {
    title: "Qué garantiza",
    subtitle:
      "Cada garantía está en el código y cubierta por un test. Las invariantes contables las hace cumplir PostgreSQL, no la aplicación.",
    items: [
      {
        title: "Balanceado",
        body: "Toda transacción posteada balancea por activo. Lo verifica un trigger diferido en PostgreSQL al COMMIT, así que un INSERT directo por SQL también se rechaza.",
      },
      {
        title: "Historia inmutable",
        body: "Los postings son append-only: UPDATE y DELETE fallan en la base de datos, incluso para un superusuario. Una transacción solo avanza draft → posted → reversed.",
      },
      {
        title: "Dinero exacto",
        body: "Montos BIGINT en unidades menores, con código de activo y exponente. Ningún float en el camino del dinero; lo que no cabe se rechaza, no se redondea.",
      },
      {
        title: "Escrituras idempotentes",
        body: "Toda mutación exige Idempotency-Key. La misma llave con el mismo payload devuelve el resultado original; con otro payload, es un conflicto.",
      },
      {
        title: "Correcciones por reverso",
        body: "Un reverso es una transacción nueva que referencia a la original. Los postings originales nunca se tocan.",
      },
      {
        title: "Aislamiento entre tenants",
        body: "Row-Level Security forzada en cada tabla de negocio, y servicios que conectan con roles sin BYPASSRLS. Los tests de aislamiento corren con esos roles reales.",
      },
    ],
    link: "Las garantías completas, y lo que no garantiza →",
  },
  tryIt: {
    title: "Pruébalo en 1 minuto",
    subtitle:
      "Solo necesitas Docker con Compose v2 (más curl y python3 para los scripts). El primer build de las imágenes tarda unos minutos; después, levantarlo y cargar datos es cuestión de segundos.",
    notes: [
      "Levanta PostgreSQL, NATS, el gateway y los servicios Go, y aplica las migraciones.",
      "Carga un escenario de wallets: depósitos y retiros con fee, un reverso, un hold capturado y un borrador descartado. Idempotente.",
      "Ejecuta cada afirmación del README contra tu instancia y la verifica: 37 aserciones, incluidos los casos que deben fallar.",
    ],
    consoleNote: "¿Quieres la consola en :3000? Añade --profile web al compose.",
  },
  trust: [
    "Append-only por diseño",
    "Aislamiento entre tenants probado con roles reales",
    "Dinero como enteros, nunca floats",
  ],
  finalCta: {
    title: "Deja de reconstruir el ledger. Constrúyelo una sola vez, bien.",
    subtitle:
      "Código fuente disponible bajo FSL-1.1; cada versión pasa a Apache-2.0 a los dos años. Etapa temprana: clónalo, léelo y corre los escenarios antes de confiarle nada. ¿Sin Docker a mano? Prueba el sandbox hospedado.",
    ctaPrimary: "Probar el sandbox",
    ctaSecondary: "Ver la consola demo",
  },
  footer: {
    tagline: "LedgerCore — infraestructura financiera",
  },
  comments: {
    title: "Comentarios",
    empty: "Todavía no hay comentarios. Si algo de acá te resuena o te parece equivocado, decilo.",
    nameLabel: "Tu nombre",
    namePlaceholder: "Tu nombre",
    bodyLabel: "Tu comentario",
    bodyPlaceholder: "¿Te pasó algo parecido? ¿Ves un error acá?",
    replyPlaceholder: "Tu respuesta…",
    send: "Comentar",
    sendReply: "Responder",
    sending: "Enviando…",
    reply: "Responder",
    cancelReply: "Cancelar respuesta",
    cancel: "Cancelar",
    footnote: "Se publica al instante. No pedimos correo ni guardamos tu IP.",
    errRateLimited: "Demasiados comentarios seguidos. Probá de nuevo en un rato.",
    errUnavailable: "Los comentarios no están disponibles en este momento.",
    errInvalid: "Revisá el nombre y el texto del comentario.",
    errNetwork: "No se pudo enviar. Revisá tu conexión.",
  },
  login: {
    tagline: "Consola de operaciones · ledger de doble entrada",
    title: "Iniciar sesión",
    expired:
      "Tu sesión expiró o la llave dejó de ser válida. Vuelve a entrar con tu API key.",
    apiKeyLabel: "API key",
    apiKeyPlaceholder: "lk_sandbox_… o lk_live_…",
    rememberLabel: "Recordar en este dispositivo",
    rememberHint:
      "Guarda tu API key en el almacenamiento local del navegador para no volver a pegarla. Úsalo solo en equipos de confianza.",
    errInvalidKey:
      "API key inválida, revocada o de un tenant inactivo. Verifica que copiaste la llave completa (lk_…).",
    errNetwork: "No se pudo contactar la API. Verifica tu conexión e intenta de nuevo.",
    errGeneric: "No se pudo iniciar sesión. Intenta de nuevo.",
    submitBusy: "Verificando llave…",
    submit: "Entrar con API key",
    jwtNotePre:
      "La llave se intercambia por un JWT de 15 minutos que la consola renueva sola. ¿No tienes llave? ",
    jwtNoteLink: "Crea un tenant",
    or: "o",
    demoMode: "Entrar en modo demo",
  },
  signup: {
    metaTitle: "Crear sandbox · LedgerCore",
    tagline: "Sandbox gratuito · ledger de doble entrada",
    createTitle: "Crear sandbox",
    days: "14 días",
    emailLabel: "Correo de trabajo",
    emailPlaceholder: "tu@empresa.com",
    companyLabel: "Nombre de la empresa",
    companyPlaceholder: "Acme Payments",
    submitBusy: "Creando sandbox…",
    submit: "Crear tenant",
    footnote:
      "Un sandbox por correo. El tenant y todos sus datos se eliminan automáticamente a los 14 días.",
    errEmailTaken: "Ese correo ya creó un tenant sandbox.",
    errLimit: "Se alcanzó el límite diario de registros. Intenta mañana.",
    errInvalid: "Datos inválidos.",
    errGeneric: "No se pudo crear el sandbox.",
    errNetwork: "No se pudo contactar la API. Intenta de nuevo.",
    readyTitle: "Sandbox listo",
    keyIntroPre: "Esta es tu API key. Se muestra ",
    keyIntroStrong: "una sola vez",
    keyIntroPost: ": guárdala ahora.",
    copied: "Copiada",
    copy: "Copiar",
    copiedCurl: "Copiado",
    demoIntro:
      "Flujo demo — token, ledger, cuentas y un depósito de 100.00 USD (10000 → 9700 wallet + 300 fee):",
    tenantPre: "Tenant",
    expiresPre: "expira el",
    purgeNote: "Después de esa fecha el tenant y sus datos se purgan automáticamente.",
    goConsole: "Ir a la consola",
    nextStepPre: "Siguiente paso:",
    nextStepLink: "el quickstart — tu primera transacción en 10 minutos",
    footerBrand: "LedgerCore — infraestructura financiera",
    haveAccount: "¿Ya tienes cuenta?",
    curlComments: {
      step1: "# 1. Token de acceso (JWT de 15 min)",
      step2: "# 2. Crear un ledger",
      step3: "# 3. Tres cuentas: caja (activo), wallet del cliente y comisiones",
      step4: "# 4. Deposito de 100.00 USD (10000 centavos): 9700 al wallet + 300 de fee",
    },
  },
};

const en: typeof es = {
  meta: {
    title: "LedgerCore — the double-entry ledger for fintechs",
    description:
      "Source-available double-entry ledger: balanced entries, immutable history, exact money, and idempotency, enforced by PostgreSQL. Run it locally with docker compose.",
  },
  nav: {
    docs: "Docs",
    quickstart: "Quickstart",
    login: "Sign in",
    trySandbox: "Try the sandbox",
    ariaLabel: "Main",
    home: "Home",
    homeAriaLabel: "LedgerCore — go to home",
  },
  hero: {
    badge: "Source-available · FSL-1.1 → Apache-2.0 · pre-1.0",
    titlePre: "The double-entry ledger for fintechs that ",
    titleHighlight: "move money",
    titlePost: "",
    subtitle:
      "Where is the money, who owns it, and which operation explains every cent? LedgerCore answers that question at all times — with database guarantees, not spreadsheets.",
    ctaPrimary: "Try it in 1 minute",
    ctaSecondary: "View the code on GitHub",
  },
  bench: {
    items: [
      { value: "~390 tx/s", label: "per ledger, with 8 to 64 concurrent clients and zero errors" },
      { value: "~1,170 tx/s", label: "spreading the load across ledgers (one ledger per worker)" },
      { value: "42 ms", label: "p99 with 32 concurrent workers, end to end over HTTP" },
    ],
    foot: "Measured on a laptop (Ryzen 7 7840HS, Docker Desktop, stock PostgreSQL settings) against the public API. ",
    link: "Methodology and how to run it yourself →",
  },
  scenarios: {
    answerLabel: "What LedgerCore does:",
    title: "Four scenarios you've already lived",
    subtitle:
      "These aren't hypotheticals — they're the nights that made us build this. If you recognize one, you already know what LedgerCore is for.",
    items: [
      {
        role: "Finance / Month-end close",
        title: "The balance doesn't match and nobody knows since when",
        scenario:
          "Wallet totals say one thing, the bank statement says another. The gap has been there for weeks, and the close is stuck while someone walks transaction by transaction.",
        answer:
          "Every balance is the sum of its entries, not a column someone writes. Recompute it as of any cutoff date and see the exact point where the two series diverge.",
      },
      {
        role: "Compliance / Audit",
        title: "You're asked to justify a movement from eight months ago",
        scenario:
          "The auditor points at an old line and asks what caused it. The record has been updated three times since, and the previous state was never kept anywhere.",
        answer:
          "The ledger is append-only: nothing is edited, everything is corrected with a new entry. Every cent keeps the operation that originated it, and the full history is reconstructable.",
      },
      {
        role: "Engineering / Platform",
        title: "The retry credited the same customer twice",
        scenario:
          "The provider never got your 200, retried the callback, and the deposit landed twice. You find out days later, once the customer has already withdrawn the difference.",
        answer:
          "The Idempotency-Key is part of the contract, not a convention. The second POST returns the same transaction instead of creating another one — a retry stops being a risk.",
      },
      {
        role: "Support / Operations",
        title: "Funds are held with no live operation behind them",
        scenario:
          "A customer reports their available balance is short. Money is reserved by an operation that never completed nor got cancelled, and releasing it means touching the database by hand.",
        answer:
          "Holds are first-class: reserved, expired, and released with the same accounting rigor as a posting. Available balance is always posted minus live holds, and each hold is visible with its origin.",
      },
    ],
    footNote:
      "Your scenario isn't here? Open an issue on GitHub — that's exactly what we want to hear.",
  },
  how: {
    title: "One API, always-balanced entries",
    subtitle:
      "A USD 100 deposit with a 3 fee: one POST, three postings, and the debits = credits invariant enforced by the engine.",
    responseNote:
      "10000 = 9700 + 300. Amounts in minor units (cents), as integers. If it doesn't balance, it doesn't post.",
    quickstartCta: "Do it yourself: from 0 to your first transaction in 10 minutes →",
  },
  guarantees: {
    title: "What it guarantees",
    subtitle:
      "Each guarantee is in the code and covered by a test. The accounting invariants are enforced by PostgreSQL, not by application code.",
    items: [
      {
        title: "Balanced",
        body: "Every posted transaction balances per asset. A deferred constraint trigger checks it at COMMIT, so a direct SQL INSERT is rejected too.",
      },
      {
        title: "Immutable history",
        body: "Postings are append-only: UPDATE and DELETE fail in the database, even for a superuser. A transaction only moves draft → posted → reversed.",
      },
      {
        title: "Exact money",
        body: "BIGINT amounts in minor units, with an asset code and exponent. No floats on the money path; what doesn't fit is rejected, not rounded.",
      },
      {
        title: "Idempotent writes",
        body: "Every mutation requires an Idempotency-Key. The same key and payload return the original result; a different payload is a conflict.",
      },
      {
        title: "Reversible corrections",
        body: "A reversal is a new transaction referencing the original. The original postings are never touched.",
      },
      {
        title: "Tenant isolation",
        body: "Row-Level Security forced on every business table, and services that connect as roles without BYPASSRLS. The isolation tests run as those real roles.",
      },
    ],
    link: "The full guarantees, and what it does not guarantee →",
  },
  tryIt: {
    title: "Try it in 1 minute",
    subtitle:
      "All you need is Docker with Compose v2 (plus curl and python3 for the scripts). The first image build takes a few minutes; after that, starting it and loading data takes seconds.",
    notes: [
      "Starts PostgreSQL, NATS, the gateway and the Go services, and runs the migrations.",
      "Loads a wallet scenario: deposits and withdrawals with fees, a reversal, a captured hold, and a discarded draft. Idempotent.",
      "Runs every claim in the README against your instance and checks it: 37 assertions, including the cases that must fail.",
    ],
    consoleNote: "Want the console on :3000? Add --profile web to the compose command.",
  },
  trust: [
    "Append-only by design",
    "Tenant isolation tested as real roles",
    "Money as integers, never floats",
  ],
  finalCta: {
    title: "Stop rebuilding the ledger. Build it once, and build it right.",
    subtitle:
      "Source-available under FSL-1.1; each version becomes Apache-2.0 after two years. Early-stage: clone it, read it, and run the scenarios before you trust it with anything. No Docker at hand? Try the hosted sandbox.",
    ctaPrimary: "Try the sandbox",
    ctaSecondary: "See the demo console",
  },
  footer: {
    tagline: "LedgerCore — financial infrastructure",
  },
  comments: {
    title: "Comments",
    empty: "No comments yet. If something here resonates — or looks wrong — say so.",
    nameLabel: "Your name",
    namePlaceholder: "Your name",
    bodyLabel: "Your comment",
    bodyPlaceholder: "Have you hit something similar? See a mistake here?",
    replyPlaceholder: "Your reply…",
    send: "Post comment",
    sendReply: "Reply",
    sending: "Sending…",
    reply: "Reply",
    cancelReply: "Cancel reply",
    cancel: "Cancel",
    footnote: "Published instantly. We ask for no email and store no IP.",
    errRateLimited: "Too many comments in a row. Try again in a while.",
    errUnavailable: "Comments are unavailable right now.",
    errInvalid: "Check the name and the comment text.",
    errNetwork: "Could not send. Check your connection.",
  },
  login: {
    tagline: "Operations console · double-entry ledger",
    title: "Sign in",
    expired:
      "Your session expired or the key is no longer valid. Sign in again with your API key.",
    apiKeyLabel: "API key",
    apiKeyPlaceholder: "lk_sandbox_… or lk_live_…",
    rememberLabel: "Remember on this device",
    rememberHint:
      "Stores your API key in the browser's local storage so you don't have to paste it again. Use only on trusted machines.",
    errInvalidKey:
      "Invalid or revoked API key, or an inactive tenant. Check that you copied the full key (lk_…).",
    errNetwork: "Could not reach the API. Check your connection and try again.",
    errGeneric: "Could not sign in. Please try again.",
    submitBusy: "Verifying key…",
    submit: "Sign in with API key",
    jwtNotePre:
      "The key is exchanged for a 15-minute JWT that the console renews on its own. No key yet? ",
    jwtNoteLink: "Create a free sandbox",
    or: "or",
    demoMode: "Enter demo mode",
  },
  signup: {
    metaTitle: "Create sandbox · LedgerCore",
    tagline: "Free sandbox · double-entry ledger",
    createTitle: "Create sandbox",
    days: "14 days",
    emailLabel: "Work email",
    emailPlaceholder: "you@company.com",
    companyLabel: "Company name",
    companyPlaceholder: "Acme Payments",
    submitBusy: "Creating sandbox…",
    submit: "Create free sandbox",
    footnote:
      "One sandbox per email. The tenant and all its data are automatically deleted after 14 days.",
    errEmailTaken: "That email has already created a sandbox tenant.",
    errLimit: "The daily signup limit has been reached. Try again tomorrow.",
    errInvalid: "Invalid data.",
    errGeneric: "Could not create the sandbox.",
    errNetwork: "Could not reach the API. Please try again.",
    readyTitle: "Sandbox ready",
    keyIntroPre: "This is your API key. It's shown ",
    keyIntroStrong: "only once",
    keyIntroPost: " — save it now.",
    copied: "Copied",
    copy: "Copy",
    copiedCurl: "Copied",
    demoIntro:
      "Demo flow — token, ledger, accounts, and a 100.00 USD deposit (10000 → 9700 wallet + 300 fee):",
    tenantPre: "Tenant",
    expiresPre: "expires on",
    purgeNote: "After that date the tenant and its data are automatically purged.",
    goConsole: "Go to the console",
    nextStepPre: "Next step:",
    nextStepLink: "the quickstart — your first transaction in 10 minutes",
    footerBrand: "LedgerCore — financial infrastructure",
    haveAccount: "Already have an account?",
    curlComments: {
      step1: "# 1. Access token (15-min JWT)",
      step2: "# 2. Create a ledger",
      step3: "# 3. Three accounts: cash (asset), customer wallet, and fees",
      step4: "# 4. Deposit of 100.00 USD (10000 cents): 9700 to the wallet + 300 fee",
    },
  },
};

export const DICTIONARIES: Record<Lang, typeof es> = { es, en };

export type Dictionary = typeof es;
