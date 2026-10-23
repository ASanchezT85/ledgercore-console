// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: LicenseRef-Proprietary

// Request signing of ADR-023 (scheme LC1-HMAC-SHA256) as a Postman
// pre-request script. It is plain ES5 so it runs in Postman's sandbox
// (which provides CryptoJS) and in node, where scripts/build-downloads.mjs
// replays contracts/test-vectors/request-signatures.json against it: the
// same vectors the Go, TypeScript and PHP implementations pass.
//
// Everything above the "Postman wiring" marker is the signer; the code below
// it only reads the request and sets the four headers.

var LC_VERSION = "LC1-HMAC-SHA256";

function lcUtf8(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      var d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function lcIsHex(c) {
  return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
}

// Percent-decodes to bytes; plusIsSpace is the form-style rule for queries.
function lcDecode(s, plusIsSpace) {
  var src = lcUtf8(s);
  var out = [];
  for (var i = 0; i < src.length; i++) {
    var c = src[i];
    if (c === 0x25) {
      var h = src[i + 1];
      var l = src[i + 2];
      if (h === undefined || l === undefined || !lcIsHex(h) || !lcIsHex(l)) {
        throw new Error("malformed percent-encoding in path or query");
      }
      out.push(parseInt(String.fromCharCode(h, l), 16));
      i += 2;
    } else {
      out.push(plusIsSpace && c === 0x2b ? 0x20 : c);
    }
  }
  return out;
}

// Percent-encodes every byte except the RFC 3986 unreserved characters.
function lcEncode(bytes) {
  var hex = "0123456789ABCDEF";
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    var c = bytes[i];
    if ((c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39) ||
        c === 0x2d || c === 0x2e || c === 0x5f || c === 0x7e) {
      out += String.fromCharCode(c);
    } else {
      out += "%" + hex.charAt(c >> 4) + hex.charAt(c & 15);
    }
  }
  return out;
}

function lcCompare(a, b) {
  var n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

function lcPath(path) {
  if (path === "") return "/";
  return path
    .split("/")
    .map(function (seg) { return lcEncode(lcDecode(seg, false)); })
    .join("/");
}

function lcQuery(raw) {
  var pairs = [];
  raw.split("&").forEach(function (part) {
    if (part === "") return;
    var eq = part.indexOf("=");
    var k = eq < 0 ? part : part.slice(0, eq);
    var v = eq < 0 ? "" : part.slice(eq + 1);
    pairs.push([lcDecode(k, true), lcDecode(v, true)]);
  });
  pairs.sort(function (a, b) { return lcCompare(a[0], b[0]) || lcCompare(a[1], b[1]); });
  return pairs.map(function (p) { return lcEncode(p[0]) + "=" + lcEncode(p[1]); }).join("&");
}

// input: method, host, path, rawQuery, idempotencyKey, apiKey, secret, timestamp, nonce, body (exact text sent)
// Returns { bodySha256, canonical, signature }.
function lcSign(input, CryptoJS) {
  var bodySha256 = CryptoJS.SHA256(input.body).toString(CryptoJS.enc.Hex);
  var canonical = [
    LC_VERSION,
    input.method.toUpperCase(),
    input.host.toLowerCase(),
    lcPath(input.path),
    lcQuery(input.rawQuery),
    input.apiKey,
    input.timestamp,
    input.nonce,
    input.idempotencyKey,
    bodySha256,
  ].join("\n");
  var signature = CryptoJS.HmacSHA256(canonical, input.secret).toString(CryptoJS.enc.Hex);
  return { bodySha256: bodySha256, canonical: canonical, signature: signature };
}

// ---- Postman wiring --------------------------------------------------------
if (typeof pm !== "undefined") {
  (function () {
    var apiKey = pm.variables.get("apiKey");
    var secret = pm.variables.get("apiSecret");
    if (!apiKey || !secret) {
      throw new Error("Set apiKey and apiSecret in the LedgerCore environment (a credential from the console).");
    }
    // The URL as it will be sent: variables resolved, then split by hand
    // (Postman's sandbox has no WHATWG URL). The host keeps its port.
    var resolved = pm.variables.replaceIn(pm.request.url.toString());
    var m = /^[a-z]+:\/\/([^\/?#]+)([^?#]*)(?:\?([^#]*))?/i.exec(resolved);
    if (!m) throw new Error("Cannot read the request URL: " + resolved);
    var host = m[1];
    var body = pm.request.body && pm.request.body.raw ? pm.variables.replaceIn(pm.request.body.raw) : "";
    var idem = pm.variables.replaceIn(pm.request.headers.get("Idempotency-Key") || "");
    var timestamp = String(Math.floor(Date.now() / 1000));
    var nonce = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
    var signed = lcSign({
      method: pm.request.method,
      host: host,
      path: m[2],
      rawQuery: m[3] || "",
      idempotencyKey: idem,
      apiKey: apiKey,
      secret: secret,
      timestamp: timestamp,
      nonce: nonce,
      body: body,
    }, CryptoJS);
    pm.request.headers.upsert({ key: "X-Api-Key", value: apiKey });
    pm.request.headers.upsert({ key: "X-Timestamp", value: timestamp });
    pm.request.headers.upsert({ key: "X-Nonce", value: nonce });
    pm.request.headers.upsert({ key: "X-Signature", value: signed.signature });
  })();
}
