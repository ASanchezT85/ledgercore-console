// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

// Prepares self-hosted assets for the developer docs portal (/docs).
// Runs as `prebuild` so the standalone build always ships them:
//   1. Copies Scalar's standalone browser bundle from node_modules into
//      public/vendor/ (served same-origin — no external CDN in production).
//   2. Syncs the OpenAPI contracts from contracts/openapi/ (source of truth)
//      into public/openapi/ when the ledgercore repo is checked out next to this one
//      (or LEDGERCORE_CONTRACTS_DIR points at its contracts/). The copies in
//      public/openapi/ are committed so the Docker build (and Vercel)
//      still works without the contracts directory.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// 1. Scalar standalone bundle
const scalarSrc = join(
  root,
  "node_modules/@scalar/api-reference/dist/browser/standalone.js",
);
const vendorDir = join(root, "public/vendor");
mkdirSync(vendorDir, { recursive: true });
copyFileSync(scalarSrc, join(vendorDir, "scalar.standalone.js"));
console.log("[docs-assets] copied scalar.standalone.js -> public/vendor/");

// The portal loads this file with a Subresource Integrity hash pinned in
// app/docs/api/scalar-sri.ts: the build stops if the package changed under it.
const sri =
  "sha384-" + createHash("sha384").update(readFileSync(scalarSrc)).digest("base64");
if (process.argv.includes("--print-sri")) {
  console.log(sri);
  process.exit(0);
}
const pinned = /SCALAR_SRI = "([^"]+)"/.exec(
  readFileSync(join(root, "app/docs/api/scalar-sri.ts"), "utf8"),
)?.[1];
if (pinned !== sri) {
  console.error(
    `[docs-assets] Scalar bundle hash ${sri} does not match the pinned ${pinned}.
` +
      "  Upgrading on purpose? Run `node scripts/prepare-docs-assets.mjs --print-sri` and update app/docs/api/scalar-sri.ts.",
  );
  process.exit(1);
}
console.log("[docs-assets] Scalar bundle matches its pinned SRI hash");

// 2. OpenAPI contracts (ledgercore repo is the source of truth -> committed copies)
const contractsDir = join(
  process.env.LEDGERCORE_CONTRACTS_DIR ?? join(root, "../ledgercore/contracts"),
  "openapi",
);
const specDir = join(root, "public/openapi");
mkdirSync(specDir, { recursive: true });
if (existsSync(contractsDir)) {
  for (const f of readdirSync(contractsDir).filter((f) => f.endsWith(".yaml"))) {
    copyFileSync(join(contractsDir, f), join(specDir, f));
  }
  console.log("[docs-assets] synced contracts/openapi -> public/openapi/");
} else {
  console.log(
    "[docs-assets] contracts/openapi not found; using committed copies in public/openapi/",
  );
}
