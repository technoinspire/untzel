// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Received text is never executed and never parsed as HTML: whoever shows it (controls,
// apps/web) uses textContent. This scan fails the build when that changes.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../../", import.meta.url).pathname;
const SCANNED = ["packages/share/src", "packages/export/src", "packages/skins/booth/src", "apps/web/src"];
const FORBIDDEN = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\.innerHTML\b/, /\.outerHTML\b/, /\binsertAdjacentHTML\b/];

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return entry === "generated" ? [] : sources(path);
    return /\.ts$/.test(entry) && !/\.test\.ts$/.test(entry) ? [path] : [];
  });
}

describe("received text", () => {
  it("has no eval, new Function, innerHTML, outerHTML or insertAdjacentHTML on its way", () => {
    const found = SCANNED.flatMap((directory) => sources(join(ROOT, directory))).flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return FORBIDDEN.filter((pattern) => pattern.test(text)).map((pattern) => `${path}: ${pattern.source}`);
    });
    expect(found).toEqual([]);
  });
});
