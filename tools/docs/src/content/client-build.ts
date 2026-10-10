// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The client (copy buttons, search, language links) and the stylesheet, built by Vite's
// build() as apps/web is: base "./", hashed names, nothing inlined as data: (the CSP would
// block it). Built in a scratch folder; only assets/ is copied, never .vite/manifest.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";
import type { ClientAssets } from "../render/layout";

const ENTRY = "src/client/main.ts";

interface ManifestChunk {
  readonly file: string;
  readonly css?: readonly string[];
}

export async function buildClient(repo: string, scratch: string): Promise<ClientAssets> {
  await build({
    configFile: false,
    root: join(repo, "apps/docs"),
    base: "./",
    logLevel: "error",
    publicDir: false,
    build: {
      outDir: scratch,
      emptyOutDir: true,
      target: "es2023",
      manifest: true,
      assetsInlineLimit: 0,
      modulePreload: false,
      rollupOptions: { input: join(repo, "apps/docs", ENTRY) },
    },
  });
  const manifest = JSON.parse(readFileSync(join(scratch, ".vite/manifest.json"), "utf8")) as Record<string, ManifestChunk>;
  const entry = manifest[ENTRY];
  if (entry === undefined) throw new Error(`the client manifest has no ${ENTRY}`);
  return { script: entry.file, styles: entry.css ?? [] };
}
