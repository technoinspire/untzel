// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Local static server for the built docs under /docs/, with the production headers
// the site sends: the same CSP, a 301 to the trailing slash, 404 for unknown paths.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, sep } from "node:path";
import { DOCS_PATH } from "./content/site";

export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'self'";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Headers of a docs response, as the site must send them. */
export function headersFor(file: string): Record<string, string> {
  const immutable = /\/assets\//.test(file);
  return {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "content-security-policy": CONTENT_SECURITY_POLICY,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  };
}

/** The file of a request path, or a redirect, or null for 404. Never leaves root. */
export function resolveRequest(root: string, urlPath: string): { file: string } | { redirect: string } | null {
  if (!urlPath.startsWith(DOCS_PATH)) return null;
  const relative = decodeURIComponent(urlPath.slice(DOCS_PATH.length));
  const target = normalize(join(root, relative));
  const base = normalize(root).replace(/[\\/]$/, "");
  // A sibling such as dist-other shares the prefix; only the root or a path below it counts.
  if (target !== base && !target.startsWith(`${base}${sep}`)) return null;
  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!urlPath.endsWith("/")) return { redirect: `${urlPath}/` };
    const index = join(target, "index.html");
    return existsSync(index) ? { file: index } : null;
  }
  return existsSync(target) ? { file: target } : null;
}

export function serveDocs(root: string, port = 0): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?")[0] ?? "/";
    const resolved = resolveRequest(root, path);
    if (resolved === null) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "content-security-policy": CONTENT_SECURITY_POLICY });
      response.end("Not found\n");
      return;
    }
    if ("redirect" in resolved) {
      response.writeHead(301, { location: resolved.redirect });
      response.end();
      return;
    }
    response.writeHead(200, headersFor(resolved.file));
    response.end(readFileSync(resolved.file));
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${address.port}${DOCS_PATH}` });
    });
  });
}
