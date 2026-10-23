// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

// Builds the portal's downloads from the OpenAPI contracts (source of truth):
//   public/downloads/ledgercore.postman_collection.json   every signed operation, with the
//                                                          ADR-023 request signer as pre-request script
//   public/downloads/ledgercore.postman_environment.json  baseUrl, apiKey, apiSecret
//   public/downloads/request-signatures.json              the shared signing test vectors
// The outputs are committed (Vercel and the Docker build only see this repo), so:
//   node scripts/build-downloads.mjs           regenerate them (prebuild)
//   node scripts/build-downloads.mjs --check   fail if they are stale (the make verify gate)
// Both first replay the signing vectors against the Postman script, so a signer
// that drifts from the Go / TypeScript / PHP implementations never ships.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// The contracts live in the ledgercore repo; by default a sibling checkout.
const contracts = process.env.LEDGERCORE_CONTRACTS_DIR ?? join(root, "../ledgercore/contracts");
const out = join(root, "public/downloads");
const check = process.argv.includes("--check");

if (!existsSync(join(contracts, "openapi"))) {
  if (check) {
    console.error("[downloads] contracts/ not found");
    process.exit(1);
  }
  console.log("[downloads] contracts/ not found; keeping the committed downloads");
  process.exit(0);
}

// ---- the signer, replayed against the shared vectors ----------------------------
const signerSrc = readFileSync(join(root, "scripts/postman-signing.js"), "utf8");

// The slice of CryptoJS the signer uses, on node's crypto.
const CryptoJS = {
  enc: { Hex: "hex" },
  SHA256: (s) => ({ toString: (enc) => createHash("sha256").update(s, "utf8").digest(enc) }),
  HmacSHA256: (s, key) => ({ toString: (enc) => createHmac("sha256", key).update(s, "utf8").digest(enc) }),
};
const lcSign = new Function("CryptoJS", `${signerSrc}\nreturn lcSign;`)(CryptoJS);

const vectors = JSON.parse(readFileSync(join(contracts, "test-vectors/request-signatures.json"), "utf8"));
let bad = 0;
for (const v of vectors.vectors) {
  const r = lcSign(
    {
      method: v.request.method,
      host: v.request.host,
      path: v.request.path,
      rawQuery: v.request.query,
      idempotencyKey: v.request.idempotency_key,
      apiKey: v.api_key,
      secret: v.secret,
      timestamp: v.timestamp,
      nonce: v.nonce,
      body: v.request.body,
    },
    CryptoJS,
  );
  for (const k of ["canonical", "signature"]) {
    if (r[k] !== v.expected[k]) {
      console.error(`[downloads] vector "${v.name}": ${k} differs`);
      bad++;
    }
  }
  if (r.bodySha256 !== v.expected.body_sha256) {
    console.error(`[downloads] vector "${v.name}": body_sha256 differs`);
    bad++;
  }
}
if (bad) process.exit(1);
console.log(`[downloads] Postman signer matches ${vectors.vectors.length} shared vectors`);

// ---- the collection ---------------------------------------------------------------
const SPECS = [
  ["ledger.v1.yaml", "Ledger Core"],
  ["reconciliation.v1.yaml", "Reconciliation"],
  ["webhooks.v1.yaml", "Webhooks"],
];
const METHODS = ["get", "post", "put", "patch", "delete"];

const resolveRef = (doc, node) => {
  while (node && node.$ref) {
    node = node.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((o, k) => o?.[k], doc);
  }
  return node;
};

function exampleBody(doc, op) {
  const media = resolveRef(doc, op.requestBody)?.content?.["application/json"];
  if (!media) return null;
  let ex = media.example;
  if (ex === undefined && media.examples) ex = resolveRef(doc, Object.values(media.examples)[0])?.value;
  if (ex === undefined || ex === null || typeof ex !== "object") return null;
  // The signer hashes the exact body, so a fresh key per send is a variable the
  // pre-request script sets, not a {{$guid}} Postman would resolve a second time.
  if ("idempotency_key" in ex) ex = { ...ex, idempotency_key: "{{idempotencyKey}}" };
  return JSON.stringify(ex, null, 2);
}

function buildItem(doc, path, method, op) {
  const params = (op.parameters ?? []).map((p) => resolveRef(doc, p)).filter(Boolean);
  const pathVars = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const query = params
    .filter((p) => p.in === "query")
    .map((p) => ({ key: p.name, value: "", disabled: true, description: p.description?.split("\n")[0] ?? "" }));
  const body = exampleBody(doc, op);
  const header = [{ key: "Accept", value: "application/json" }];
  if (body) header.push({ key: "Content-Type", value: "application/json" });
  if (method === "post" && (body?.includes("{{idempotencyKey}}") || params.some((p) => p.name === "Idempotency-Key")))
    header.push({ key: "Idempotency-Key", value: "{{idempotencyKey}}" });
  const urlPath = path.replace(/\{(\w+)\}/g, ":$1");
  return {
    name: op.summary ?? op.operationId,
    request: {
      method: method.toUpperCase(),
      header,
      ...(body ? { body: { mode: "raw", raw: body, options: { raw: { language: "json" } } } } : {}),
      url: {
        raw: `{{baseUrl}}${urlPath}`,
        host: ["{{baseUrl}}"],
        path: urlPath.split("/").filter(Boolean),
        ...(query.length ? { query } : {}),
        ...(pathVars.length ? { variable: pathVars.map((k) => ({ key: k, value: "" })) } : {}),
      },
      description: (op.description ?? op.summary ?? "").trim(),
    },
  };
}

function buildFolder(file, title) {
  const doc = parse(readFileSync(join(contracts, "openapi", file), "utf8"));
  const byTag = new Map();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      if (Array.isArray(op.security) && op.security.length === 0) continue; // public by design (callbacks)
      const tag = op.tags?.[0] ?? "Other";
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push(buildItem(doc, path, method, op));
    }
  }
  return { name: title, item: [...byTag.entries()].map(([name, item]) => ({ name, item })) };
}

const signerLines = signerSrc.split("\n");
// Every request gets a fresh idempotency key before it is signed.
const prerequest = [
  'pm.variables.set("idempotencyKey", CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex));',
  ...signerLines,
];

const collection = {
  info: {
    name: "LedgerCore API",
    description:
      "Every signed operation of the Ledger Core, Reconciliation and Webhooks APIs. Set apiKey and apiSecret in the environment (a credential from the console); each request is signed with the LC1-HMAC-SHA256 scheme of ADR-023 by the collection's pre-request script. Guides: /docs/guias/autenticacion.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  event: [{ listen: "prerequest", script: { type: "text/javascript", exec: prerequest } }],
  variable: [{ key: "baseUrl", value: "http://localhost:8080" }],
  item: SPECS.map(([file, title]) => buildFolder(file, title)),
};

// An empty body is signed as the empty string; the pre-request script handles it.
const environment = {
  name: "LedgerCore sandbox",
  values: [
    { key: "baseUrl", value: "http://localhost:8080", type: "default", enabled: true },
    { key: "apiKey", value: "", type: "default", enabled: true },
    { key: "apiSecret", value: "", type: "secret", enabled: true },
  ],
  _postman_variable_scope: "environment",
};

const files = {
  "ledgercore.postman_collection.json": JSON.stringify(collection, null, 2) + "\n",
  "ledgercore.postman_environment.json": JSON.stringify(environment, null, 2) + "\n",
};

if (check) {
  let stale = 0;
  for (const [name, text] of Object.entries(files)) {
    const p = join(out, name);
    if (!existsSync(p) || readFileSync(p, "utf8") !== text) {
      console.error(`[downloads] ${name} is stale: run "node scripts/build-downloads.mjs" and commit it`);
      stale++;
    }
  }
  const v = join(out, "request-signatures.json");
  if (!existsSync(v) || readFileSync(v, "utf8") !== readFileSync(join(contracts, "test-vectors/request-signatures.json"), "utf8")) {
    console.error('[downloads] request-signatures.json is stale: run "node scripts/build-downloads.mjs" and commit it');
    stale++;
  }
  if (stale) process.exit(1);
  console.log("[downloads] up to date");
} else {
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
  copyFileSync(join(contracts, "test-vectors/request-signatures.json"), join(out, "request-signatures.json"));
  console.log("[downloads] wrote public/downloads/");
}
