# LedgerCore Console

Consola web de LedgerCore: el dashboard que usan los equipos de finanzas y los
desarrolladores de los clientes para operar el ledger — balances custodiados,
transacciones de doble partida, conciliación contra fuentes externas y
herramientas de integración (API keys, webhooks).

Construida con **Next.js (App Router) + TypeScript strict + Tailwind CSS v4**,
tema oscuro por defecto y componentes UI propios (sin librerías de componentes
externas).

## Requisitos

- Node.js 26+
- pnpm 11+

## Arranque rápido

```bash
cd ledgercore-console
pnpm install
pnpm dev        # http://localhost:3000
```

Scripts disponibles:

| Script       | Descripción                                   |
| ------------ | --------------------------------------------- |
| `pnpm dev`   | Servidor de desarrollo en el puerto 3000      |
| `pnpm build` | Build de producción (salida `standalone`)     |
| `pnpm start` | Sirve el build de producción                  |
| `pnpm lint`  | Chequeo de tipos estricto (`tsc --noEmit`)    |

## Configuración

Copia `.env.example` a `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```

`NEXT_PUBLIC_API_URL` apunta al gateway (Traefik) que enruta hacia los
servicios Go (`ledger-core`, `identity`, `reconciliation`, `webhooks`).

### Sesión y usuarios (ADR-021)

La consola se entra con **email y contraseña**, no con una API key (la key
queda solo para integraciones y la consola nunca la guarda). El navegador habla
con identity a través del proxy same-origin `app/api/identity/[...path]`, que
reenvía a `LEDGERCORE_IDENTITY_URL` (solo en el servidor; si falta usa
`NEXT_PUBLIC_API_URL`): así la cookie de sesión (`HttpOnly; Secure;
SameSite=Lax`) vive en el origen de la consola y identity rechaza cualquier
petición con cabecera `Origin`. El proxy solo expone las rutas que la consola
usa. En memoria viven el token CSRF y el JWT de 15 minutos (se pide a
`POST /v1/auth/session/token` y se renueva solo); en `localStorage` queda solo
una marca no secreta (`lc_signed_in`) para distinguir una sesión real del modo
demo. Hasta que exista el SMTP (7.9) los enlaces de invitación y reset se leen
del log de identity.

Cuando la consola corre lejos de identity (Vercel), el gateway descarta su
`X-Forwarded-For`; por eso también manda la IP del navegador en
`X-Ledgercore-Client-Ip` junto al secreto `LEDGERCORE_CONSOLE_TOKEN`, el mismo
valor configurado en identity y en el gateway (`lib/client-headers.ts`). Sin
ese secreto, identity ve la IP del servidor de la consola y todos los usuarios
comparten el bloqueo por intentos fallidos.

### Verificación en dos pasos (ADR-022)

Es obligatoria: tras la contraseña, `/login/2fa` pregunta a identity
(`GET /v1/auth/2fa`) qué mostrar, así que un reload cae en la pantalla
correcta. Sin autenticador: QR (dibujado en el navegador con `uqr`, sin red:
el URI `otpauth://` lleva el secreto) más la clave en texto, un código para
confirmar y los 10 códigos de recuperación, que se ven **una sola vez** (con
botón de copiar) y no se guardan en ningún storage. Con autenticador: el código
de 6 dígitos, o un código de recuperación. En `/users`, un owner o admin
resetea el 2FA de otro usuario y cada quien puede regenerar sus códigos de
recuperación con un código nuevo de la app.

### Modo demo

Los servicios Go se construyen en paralelo, así que la consola **nunca asume
que el API está disponible**. La capa de datos (`lib/api.ts`) intenta cada
fetch contra `NEXT_PUBLIC_API_URL` y, si la variable no está definida, el
request falla o supera el timeout, responde con **datos de demostración**
realistas y consistentes. Toda página que esté renderizando datos demo lo
marca visualmente con el badge «datos de demostración».

## Páginas

| Ruta              | Contenido                                                                 |
| ----------------- | ------------------------------------------------------------------------- |
| `/login`          | Email + contraseña (sesión de servidor, cookie `HttpOnly`), «olvidé mi contraseña» y acceso en modo demo |
| `/invite?token=…` | Aceptar una invitación: fijar la contraseña                               |
| `/forgot-password`, `/reset-password?token=…` | Recuperar la contraseña por email (enlace de un solo uso) |
| `/users`          | Equipo del tenant: invitar, cambiar rol, deshabilitar (solo `owner` y `admin`) |
| `/`               | Dashboard: balance custodiado, transacciones hoy, discrepancias, salud de conciliación |
| `/ledgers`        | Ledgers y árbol de cuentas (por `path`) con balances por asset            |
| `/transactions`   | Tabla con filtros (estado, asset) y drawer con los postings débito/crédito |
| `/reconciliation` | Corridas recientes y discrepancias (`missing_internal`, `amount_mismatch`, …) |
| `/developers`     | API keys, webhook subscriptions y snippet curl de `POST /v1/transactions` |

## Manejo de dinero

Los montos viajan y se almacenan como **enteros en unidades mínimas** más un
código de asset y su exponente (registro de assets). El helper
`formatMoney(units, asset, exponent)` en `lib/format.ts` formatea con BigInt y
numerales tabulares — nunca floats.

## Estructura

```
ledgercore-console/
├── app/
│   ├── (console)/          # layout con sidebar + páginas autenticadas
│   │   ├── page.tsx        # dashboard
│   │   ├── ledgers/
│   │   ├── transactions/
│   │   ├── reconciliation/
│   │   └── developers/
│   ├── login/
│   ├── globals.css         # tokens de diseño (Tailwind v4 @theme)
│   └── layout.tsx
├── components/
│   ├── ui/                 # Button, Card, Badge, Table, StatTile, Sidebar
│   ├── logo.tsx            # logomark SVG inline
│   └── demo-badge.tsx
└── lib/
    ├── api.ts              # fetchers con fallback a datos demo
    ├── format.ts           # formatMoney / fechas deterministas
    ├── mock-data.ts
    └── types.ts
```

## Docker

El `Dockerfile` es multi-stage (`node:26-alpine`) y usa la salida
`standalone` de Next.js. El contexto de build es la raíz de este repo:

```bash
docker build -t ledgercore/console .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://gateway:8080 ledgercore/console
```

> Nota: `NEXT_PUBLIC_*` se congela en build; para cambiar el gateway en
> producción hay que reconstruir la imagen o resolverlo vía el gateway mismo.
