// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

// The Scalar bundle the API reference loads: an exact version (package.json
// pins it without a range) and the Subresource Integrity hash of the file
// prepare-docs-assets.mjs copies out of node_modules. The prebuild fails when
// the two disagree, and the browser refuses the script if the served file is
// not byte for byte this one. To upgrade Scalar: change the version in
// package.json, run `node scripts/prepare-docs-assets.mjs --print-sri` and
// paste the new hash here.
export const SCALAR_VERSION = "1.75.0";
export const SCALAR_SRI = "sha384-xgelKlDcc+BYp0O+ZYzFesLnWCgGpEbXVVZWNQT6WyZYygN01tbEMygnjPXb5OPI";
