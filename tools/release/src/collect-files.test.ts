// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectFiles } from "./collect-files";

let root: string;

function file(path: string, content = path): void {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "untzel-collect-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("collectFiles", () => {
  it("returns every regular file as a sorted POSIX path relative to the root", () => {
    // Code-unit order puts uppercase first (C < a). C, not B: macOS volumes ignore case.
    for (const path of ["b.txt", "a/z.js", "a/b/c.css", "C.txt", "a.txt"]) file(path);
    const files = collectFiles(root);
    expect(files.map((found) => found.path)).toEqual(["C.txt", "a.txt", "a/b/c.css", "a/z.js", "b.txt"]);
    expect(files[2]?.absolutePath).toBe(join(root, "a", "b", "c.css"));
  });

  it("leaves out a nested directory with everything in it, and only that one", () => {
    for (const path of ["index.html", "docs/index.html", "docs/en/page.html", "assets/docs/keep.js"]) file(path);
    expect(collectFiles(root, { exclude: "docs" }).map((found) => found.path)).toEqual(["assets/docs/keep.js", "index.html"]);
  });

  it("rejects a symbolic link instead of following it", () => {
    file("index.html");
    symlinkSync(join(root, "index.html"), join(root, "link.html"));
    expect(() => collectFiles(root)).toThrow(/link\.html is a symbolic link/);
  });

  it("rejects a root that is not a directory", () => {
    file("index.html");
    expect(() => collectFiles(join(root, "index.html"))).toThrow(/is not a directory/);
    expect(() => collectFiles(join(root, "missing"))).toThrow(/is not a directory/);
  });
});
