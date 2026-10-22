// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

import type { GuideContent } from "../../docs-ui";
import { API_BASE } from "../../docs-ui";

// Normative scheme: ADR-023, libs/go/reqsig and contracts/test-vectors/request-signatures.json.

const CANONICAL = `X-Signature = hex( HMAC-SHA256( api_secret, canonical ) )

canonical = "LC1-HMAC-SHA256" \\n METHOD \\n host \\n path \\n query \\n api_key
            \\n timestamp \\n nonce \\n idempotency_key \\n hex(sha256(body))`;

const HEADERS_EXAMPLE = `X-Api-Key:    ak_sandbox_XXXXXXXXXXXXXXXXXXXX
X-Timestamp:  1753358400
X-Nonce:      7f3a9c1e5b2d4f60a8c1e3b5d7f90214
X-Signature:  <hex hmac-sha256>`;

// Verified against contracts/test-vectors/request-signatures.json (vectors 1 and 2).
export const curlSign = (hostNote: string, usage: string) => `export API=${API_BASE}
export HOST=\${API#*://}   # ${hostNote}
export LC_KEY=ak_sandbox_XXXXXXXXXXXXXXXXXXXX
export LC_SECRET=as_sandbox_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ${usage}
lc() {
  local p=\${2%%\\?*} q="" ts nonce bh sig
  [ "$p" != "$2" ] && q=\${2#*\\?}
  ts=$(date +%s); nonce=$(openssl rand -hex 16)
  bh=$(printf '%s' "$3" | openssl dgst -sha256 | awk '{print $NF}')
  sig=$(printf 'LC1-HMAC-SHA256\\n%s\\n%s\\n%s\\n%s\\n%s\\n%s\\n%s\\n%s\\n%s' \\
    "$1" "$HOST" "$p" "$q" "$LC_KEY" "$ts" "$nonce" "$4" "$bh" \\
    | openssl dgst -sha256 -hmac "$LC_SECRET" | awk '{print $NF}')
  curl \${LC_CURL_FLAGS:--s} -X "$1" "$API$2" -H "Content-Type: application/json" \\
    \${3:+--data-binary "$3"} \${4:+-H "Idempotency-Key: $4"} \\
    -H "X-Api-Key: $LC_KEY" -H "X-Timestamp: $ts" \\
    -H "X-Nonce: $nonce" -H "X-Signature: $sig"
}

lc GET /v1/ledgers | jq`;

const tsAuth = (note: string) => `import { LedgerCore } from "@ledgercore/sdk";

${note}
const lc = new LedgerCore({
  apiKey: process.env.LEDGERCORE_API_KEY,       // ak_sandbox_XXXXXXXXXXXXXXXXXXXX
  apiSecret: process.env.LEDGERCORE_API_SECRET, // as_sandbox_...
  baseUrl: "${API_BASE}",
});

const ledgers = await lc.ledgers.list();`;

const phpAuth = (note: string) => `use LedgerCore\\LedgerCore;

${note}
$lc = new LedgerCore([
    'api_key'    => getenv('LEDGERCORE_API_KEY'),    // ak_sandbox_XXXXXXXXXXXXXXXXXXXX
    'api_secret' => getenv('LEDGERCORE_API_SECRET'), // as_sandbox_...
    'base_url'   => '${API_BASE}',
]);

$ledgers = $lc->ledgers->list();`;

const RESP_ERROR = `{
  "error": {
    "code": "timestamp_skew",
    "message": "X-Timestamp is outside the allowed window"
  }
}`;

const rotateSnippet = (note: string, overlap: string) => `# ${note}
POST /v1/api-credentials/{id}/rotate
{ "overlap_seconds": 86400 }   # ${overlap}`;

export const GUIDE: GuideContent = {
  es: {
    badge: "Guía · Autenticación",
    title: "Autenticación: credenciales API y firma de cada request",
    subtitle:
      "Las integraciones se autentican con una credencial API (llave pública + secreto) y firman cada request con HMAC-SHA256. El secreto nunca viaja: un request, un log o un token copiados no sirven para ningún otro request. Los SDKs firman por ti.",
    backLabel: "Docs",
    copy: "Copiar",
    copied: "Copiado",
    sections: [
      {
        title: "Crea una credencial API",
        body: "En la consola, Developers → API credentials → Create credential (solo owner y admin). Eliges nombre, ambiente (sandbox o live; un tenant sandbox solo puede crear sandbox), los scopes y la vigencia (180 días por defecto, máximo 365). Recibes dos valores: api_key (ak_<env>_…, pública, va en X-Api-Key) y api_secret (as_<env>_…, solo sirve para calcular la firma). El secreto se muestra una sola vez y no se puede recuperar: guárdalo en un gestor de secretos del servidor, nunca en el frontend ni en git. Si lo pierdes, rota la credencial.",
        blocks: [
          {
            kind: "list",
            items: [
              "Los scopes son obligatorios y no hay ninguno por defecto: marca solo los que la integración necesita (ledger:read, ledger:write, reconciliation:read, reconciliation:write, webhooks:read, webhooks:write). ledger:frozen_override es peligroso y debe pedirse a propósito.",
              "Cada credencial queda sellada a su ambiente: una credencial sandbox es rechazada por producción (y al revés) con environment_mismatch.",
              "La revocación y la expiración se leen de la base de datos en cada request: el efecto es inmediato.",
            ],
          },
        ],
      },
      {
        title: "Firma cada request",
        body: "Cada request lleva cuatro cabeceras. X-Signature es el HMAC-SHA256, en hexadecimal, de una cadena canónica construida con el método, el host, la ruta, la query, la llave, el timestamp, el nonce, la Idempotency-Key y el hash del cuerpo.",
        blocks: [
          { kind: "code", label: "Cabeceras", code: HEADERS_EXAMPLE },
          { kind: "code", label: "Cadena canónica y firma", code: CANONICAL },
          {
            kind: "table",
            head: ["Cabecera", "Valor"],
            rows: [
              ["X-Api-Key", "La llave pública ak_<env>_… de la credencial."],
              ["X-Timestamp", "Segundos unix. El servidor acepta ±300 s respecto a su reloj."],
              ["X-Nonce", "16–64 caracteres de [A-Za-z0-9_-], nuevo en cada request. Se acepta una sola vez por credencial (se recuerda 600 s)."],
              ["X-Signature", "hex(HMAC-SHA256(api_secret, canonical))."],
            ],
          },
        ],
      },
      {
        title: "Reglas de la cadena canónica",
        blocks: [
          {
            kind: "list",
            items: [
              "METHOD en mayúsculas; host es el Host en minúsculas al que se conecta el cliente (un proxy que lo reescriba rompe la firma).",
              "path se recodifica segmento a segmento (un %2F nunca se vuelve /). La query se decodifica, se ordena por clave y luego por valor y se recodifica con RFC 3986: la query también se firma, así que cambiar ?limit= o ?status= después de firmar es signature_invalid.",
              "idempotency_key es el valor de la cabecera Idempotency-Key, o vacío. El cuerpo es exactamente lo enviado; si no hay cuerpo, el hash de la cadena vacía.",
              "Un reintento tras un timeout es un request nuevo: nonce y timestamp nuevos, y la misma Idempotency-Key en las operaciones que mueven dinero.",
              "Los vectores de prueba normativos están en contracts/test-vectors/request-signatures.json; Go, TypeScript y PHP pasan el mismo archivo.",
            ],
          },
        ],
      },
      {
        title: "Con el SDK de TypeScript",
        body: "Pasas la llave y el secreto una vez; el SDK genera timestamp y nonce, firma y envía las cuatro cabeceras en cada request. No hay intercambio de token.",
        blocks: [
          {
            kind: "code",
            label: "TypeScript · @ledgercore/sdk",
            code: tsAuth(
              "// El SDK firma cada request por ti. El secreto nunca sale de tu proceso.",
            ),
          },
        ],
      },
      {
        title: "Con el SDK de PHP",
        body: "Idéntico comportamiento en PHP 8.1+. Con una llave ak_ el api_secret es obligatorio.",
        blocks: [
          {
            kind: "code",
            label: "PHP · ledgercore/sdk",
            code: phpAuth("// Cada request lleva X-Api-Key, X-Timestamp, X-Nonce y X-Signature."),
          },
        ],
      },
      {
        title: "Sin SDK: curl con openssl",
        body: "Una función de shell que firma el request. Usa la query tal cual la recibe, así que debe venir ya ordenada por clave y valor y con solo caracteres no reservados (A-Z a-z 0-9 - . _ ~), como los ids UUID; para otras queries ordénala y recodifícala como indica la cadena canónica. Sus firmas coinciden con los vectores de prueba.",
        blocks: [
          {
            kind: "code",
            label: "bash · curl + openssl",
            code: curlSign(
              "el Host que envía curl (host:puerto)",
              "lc MÉTODO /ruta [cuerpo-json] [idempotency-key]   (la query, si hay, ya ordenada)",
            ),
          },
        ],
      },
      {
        title: "Rotación con solapamiento",
        body: "Rotar emite una credencial nueva (mismo nombre, ambiente y scopes) y acorta la vigencia de la anterior a ahora + solapamiento (24 h por defecto, máximo 7 días). Ambos pares funcionan durante el solapamiento, así que despliegas el nuevo sin downtime. Puedes revocar la anterior antes cuando quieras (DELETE /v1/api-credentials/{id}, efecto inmediato). El secreto nuevo también se muestra una sola vez.",
        blocks: [
          {
            kind: "code",
            label: "Rotar",
            code: rotateSnippet(
              "En la consola: Developers → API credentials → Rotate. Por API, con la sesión de la consola:",
              "24 h por defecto, máximo 604800 (7 días)",
            ),
          },
        ],
      },
      {
        title: "Errores de autenticación",
        body: "Todos usan el formato de error estándar. Una llave desconocida y una firma incorrecta responden igual (signature_invalid); credential_expired y credential_revoked solo se revelan a quien firma bien. Si identity no responde, el request se rechaza con 503 service_unavailable: nunca se acepta sin verificar.",
        blocks: [
          { kind: "resp", label: "Ejemplo", code: RESP_ERROR },
          {
            kind: "table",
            head: ["Código", "HTTP", "Qué hacer"],
            rows: [
              ["signature_missing", "401", "Faltan una o más de las cuatro cabeceras."],
              ["signature_invalid", "401", "La firma no coincide: revisa método, host, ruta, query, Idempotency-Key y los bytes exactos del cuerpo; o la llave o el secreto son incorrectos."],
              ["timestamp_skew", "401", "Tu reloj difiere más de 300 s del servidor. Sincroniza NTP y vuelve a firmar."],
              ["nonce_reused", "401", "Ese nonce ya se usó. Usa un nonce nuevo en cada intento."],
              ["credential_expired", "401", "La credencial venció. Rótala o crea otra."],
              ["credential_revoked", "401", "La credencial fue revocada. Crea otra."],
              ["environment_mismatch", "403", "Credencial de otro ambiente que el despliegue (sandbox contra producción o al revés)."],
              ["legacy_credential_retired", "401", "Las llaves lk_ ya no funcionan (ver abajo)."],
            ],
          },
        ],
      },
      {
        title: "Transición: las llaves lk_ están obsoletas",
        body: "Las API keys antiguas lk_… y POST /v1/auth/token siguen funcionando hasta el 2027-02-01. Hasta esa fecha, cada respuesta hecha con ellas incluye las cabeceras Deprecation: true y Sunset: Mon, 01 Feb 2027 00:00:00 GMT. Después responden 401 legacy_credential_retired (el operador puede adelantarlo). Para migrar: crea una credencial, pasa apiKey + apiSecret al SDK y elimina el intercambio de token. Las personas que entran a la consola no firman: usan su sesión con email y contraseña.",
      },
    ],
  },
  en: {
    badge: "Guide · Authentication",
    title: "Authentication: API credentials and signed requests",
    subtitle:
      "Integrations authenticate with an API credential (public key + secret) and sign every request with HMAC-SHA256. The secret never travels: a copied request, log line or token is useless for any other request. The SDKs sign for you.",
    backLabel: "Docs",
    copy: "Copy",
    copied: "Copied",
    sections: [
      {
        title: "Create an API credential",
        body: "In the console, Developers → API credentials → Create credential (owners and admins only). You pick a name, an environment (sandbox or live; a sandbox tenant can only create sandbox), the scopes and the term (180 days by default, at most 365). You get two values: api_key (ak_<env>_…, public, sent in X-Api-Key) and api_secret (as_<env>_…, only used to compute the signature). The secret is shown exactly once and cannot be recovered: keep it in a server-side secret manager, never in the frontend or in git. If you lose it, rotate the credential.",
        blocks: [
          {
            kind: "list",
            items: [
              "Scopes are required and none is granted by default: tick only what the integration needs (ledger:read, ledger:write, reconciliation:read, reconciliation:write, webhooks:read, webhooks:write). ledger:frozen_override is dangerous and must be requested on purpose.",
              "Every credential is sealed to its environment: a sandbox credential is refused by production (and the other way round) with environment_mismatch.",
              "Revocation and expiry are read from the database on every request: the effect is immediate.",
            ],
          },
        ],
      },
      {
        title: "Sign every request",
        body: "Every request carries four headers. X-Signature is the hex HMAC-SHA256 of a canonical string built from the method, host, path, query, key, timestamp, nonce, Idempotency-Key and the hash of the body.",
        blocks: [
          { kind: "code", label: "Headers", code: HEADERS_EXAMPLE },
          { kind: "code", label: "Canonical string and signature", code: CANONICAL },
          {
            kind: "table",
            head: ["Header", "Value"],
            rows: [
              ["X-Api-Key", "The public key ak_<env>_… of the credential."],
              ["X-Timestamp", "Unix seconds. The server accepts ±300 s from its own clock."],
              ["X-Nonce", "16–64 characters of [A-Za-z0-9_-], new on every request. Accepted once per credential (remembered 600 s)."],
              ["X-Signature", "hex(HMAC-SHA256(api_secret, canonical))."],
            ],
          },
        ],
      },
      {
        title: "Canonical string rules",
        blocks: [
          {
            kind: "list",
            items: [
              "METHOD in upper case; host is the lower-cased Host the client connects to (a proxy that rewrites it breaks the signature).",
              "path is re-encoded segment by segment (a %2F never becomes /). The query is decoded, sorted by key then value and re-encoded with RFC 3986: the query is signed too, so changing ?limit= or ?status= after signing is signature_invalid.",
              "idempotency_key is the Idempotency-Key header, or empty. The body is exactly the bytes sent; when there is none, the hash of the empty string.",
              "A retry after a timeout is a new request: new nonce and timestamp, and the same Idempotency-Key for operations that move money.",
              "The normative test vectors are in contracts/test-vectors/request-signatures.json; Go, TypeScript and PHP all pass the same file.",
            ],
          },
        ],
      },
      {
        title: "With the TypeScript SDK",
        body: "Pass the key and the secret once; the SDK generates the timestamp and nonce, signs and sends the four headers on every request. There is no token exchange.",
        blocks: [
          {
            kind: "code",
            label: "TypeScript · @ledgercore/sdk",
            code: tsAuth("// The SDK signs every request for you. The secret never leaves your process."),
          },
        ],
      },
      {
        title: "With the PHP SDK",
        body: "Identical behavior on PHP 8.1+. With an ak_ key the api_secret is required.",
        blocks: [
          {
            kind: "code",
            label: "PHP · ledgercore/sdk",
            code: phpAuth("// Every request carries X-Api-Key, X-Timestamp, X-Nonce and X-Signature."),
          },
        ],
      },
      {
        title: "Without an SDK: curl with openssl",
        body: "A shell function that signs the request. It uses the query exactly as given, so it must already be sorted by key and value and contain only unreserved characters (A-Z a-z 0-9 - . _ ~), like UUID ids; for any other query sort and re-encode it as the canonical string says. Its signatures match the test vectors.",
        blocks: [
          {
            kind: "code",
            label: "bash · curl + openssl",
            code: curlSign(
              "the Host curl sends (host:port)",
              "lc METHOD /path [json-body] [idempotency-key]   (query, if any, already sorted)",
            ),
          },
        ],
      },
      {
        title: "Rotation with an overlap window",
        body: "Rotating issues a new credential (same name, environment and scopes) and shortens the old one's term to now + overlap (24 h by default, at most 7 days). Both pairs work during the overlap, so you deploy the new one without downtime. You can revoke the old one earlier at any time (DELETE /v1/api-credentials/{id}, effective immediately). The new secret is also shown exactly once.",
        blocks: [
          {
            kind: "code",
            label: "Rotate",
            code: rotateSnippet(
              "In the console: Developers → API credentials → Rotate. Through the API, with the console session:",
              "24 h by default, at most 604800 (7 days)",
            ),
          },
        ],
      },
      {
        title: "Authentication errors",
        body: "All use the standard error format. An unknown key and a wrong signature answer the same way (signature_invalid); credential_expired and credential_revoked are only revealed to whoever signs correctly. If identity cannot be reached the request is refused with 503 service_unavailable: it is never accepted unverified.",
        blocks: [
          { kind: "resp", label: "Example", code: RESP_ERROR },
          {
            kind: "table",
            head: ["Code", "HTTP", "What to do"],
            rows: [
              ["signature_missing", "401", "One or more of the four headers is missing."],
              ["signature_invalid", "401", "The signature does not match: check method, host, path, query, Idempotency-Key and the exact body bytes; or the key or secret is wrong."],
              ["timestamp_skew", "401", "Your clock is more than 300 s from the server's. Sync NTP and sign again."],
              ["nonce_reused", "401", "That nonce was already used. Use a new nonce on every attempt."],
              ["credential_expired", "401", "The credential expired. Rotate it or create another."],
              ["credential_revoked", "401", "The credential was revoked. Create another."],
              ["environment_mismatch", "403", "Credential from another environment than the deployment (sandbox against production or the other way round)."],
              ["legacy_credential_retired", "401", "lk_ keys no longer work (see below)."],
            ],
          },
        ],
      },
      {
        title: "Transition: lk_ keys are deprecated",
        body: "The old lk_… API keys and POST /v1/auth/token keep working until 2027-02-01. Until then every response made on their behalf carries the headers Deprecation: true and Sunset: Mon, 01 Feb 2027 00:00:00 GMT. After that date they answer 401 legacy_credential_retired (an operator can cut over earlier). To migrate: create a credential, give the SDK apiKey + apiSecret and remove the token exchange. People who sign in to the console do not sign requests: they use their email and password session.",
      },
    ],
  },
};
