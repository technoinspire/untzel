// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NOTICE_FILES, releaseLayout, REQUIRED_PATHS } from "./release-layout";

let repo: string;

function file(path: string): void {
  const absolute = join(repo, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, path);
}

function sources() {
  return { app: join(repo, "dist"), docs: join(repo, "dist", "docs"), repo };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "untzel-layout-"));
  for (const path of ["dist/index.html", "dist/changelog.json", "dist/assets/app.js", "dist/docs/index.html", "dist/docs/pages.json", "dist/docs/en/index.html", ...NOTICE_FILES]) file(path);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("releaseLayout", () => {
  it("puts the app under app/ without its docs, the docs under docs/ and the notices at the root", () => {
    const entries = releaseLayout(sources());
    expect(entries.map((entry) => entry.path)).toEqual([
      "ATTRIBUTION.md",
      "LICENSE",
      "TRADEMARKS.md",
      "app/assets/app.js",
      "app/changelog.json",
      "app/index.html",
      "docs/en/index.html",
      "docs/index.html",
      "docs/pages.json",
    ]);
    expect(entries.find((entry) => entry.path === "docs/en/index.html")?.absolutePath).toBe(join(repo, "dist", "docs", "en", "index.html"));
  });

  it("keeps the whole app when the docs build lives elsewhere", () => {
    file("site-docs/index.html");
    file("site-docs/pages.json");
    const paths = releaseLayout({ ...sources(), docs: join(repo, "site-docs") }).map((entry) => entry.path);
    expect(paths).toContain("app/docs/index.html");
    expect(paths).toContain("docs/index.html");
  });

  it("requires every license notice", () => {
    rmSync(join(repo, "TRADEMARKS.md"));
    expect(() => releaseLayout(sources())).toThrow(/TRADEMARKS\.md is missing/);
  });

  it("requires the app and docs entry pages, the changelog and the docs index", () => {
    expect([...REQUIRED_PATHS]).toEqual(["app/index.html", "app/changelog.json", "docs/index.html", "docs/pages.json"]);
  });

  it.each([
    ["app/index.html", "dist/index.html"],
    ["app/changelog.json", "dist/changelog.json"],
    ["docs/index.html", "dist/docs/index.html"],
    ["docs/pages.json", "dist/docs/pages.json"],
  ])("fails when %s is missing", (required, source) => {
    rmSync(join(repo, source));
    expect(() => releaseLayout(sources())).toThrow(new RegExp(`${required.replace(/[./]/g, "\\$&")} is missing`));
  });
});
