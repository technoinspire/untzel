// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The closing card is the CPAL attribution. Only card.ts and the test-only
// ./testing may reach drawCard, the variant that can leave the logo or the URL out;
// product code draws the whole card with drawClosingCard. This scan fails the build when
// that changes.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../../", import.meta.url).pathname;
const SCANNED = ["packages", "apps", "instruments", "tools"];
const ALLOWED = new Set(["packages/export/src/brand/card.ts", "packages/export/src/testing/index.ts"]);
const SKIPPED = new Set(["node_modules", "dist", "dist-test", "generated", ".cache"]);
const PARTIAL_CARD = /\bdrawCard\b/;

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return SKIPPED.has(entry) ? [] : sources(path);
    return /\.(ts|mts|mjs|js)$/.test(entry) && !/\.test\.ts$/.test(entry) ? [path] : [];
  });
}

describe("closing card", () => {
  it("can lose its logo or URL only in card.ts and the test-only surface", () => {
    const found = SCANNED.flatMap((directory) => sources(join(ROOT, directory)))
      .map((path) => relative(ROOT, path))
      .filter((path) => !ALLOWED.has(path) && PARTIAL_CARD.test(readFileSync(join(ROOT, path), "utf8")));
    expect(found).toEqual([]);
  });
});
