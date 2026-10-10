// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { packageRelease, type PackageRequest } from "./package-release";
import { sha256Hex, type ReleaseManifest } from "./release-manifest";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
let repo: string;

function file(path: string, content = `${path}\n`): void {
  const absolute = join(repo, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function request(out: string, overrides: Partial<PackageRequest> = {}): PackageRequest {
  return {
    tag: "v0.1.0",
    commit: COMMIT,
    createdAt: "2026-10-04T09:30:15-03:00",
    repository: "technoinspire/untzel",
    app: join(repo, "dist"),
    docs: join(repo, "dist", "docs"),
    repo,
    out: join(repo, out),
    ...overrides,
  };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "untzel-package-"));
  for (const path of ["dist/index.html", "dist/changelog.json", "dist/assets/app.js", "dist/docs/index.html", "dist/docs/pages.json", "dist/docs/en/index.html", "LICENSE", "ATTRIBUTION.md", "TRADEMARKS.md"]) file(path);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("packageRelease", () => {
  it("writes the archive, the manifest and the dispatch body with matching digests", () => {
    const result = packageRelease(request("out"));
    expect(readdirSync(join(repo, "out")).sort()).toEqual(["untzel-0.1.0.dispatch.json", "untzel-0.1.0.manifest.json", "untzel-0.1.0.tar.gz"]);
    const archiveSha256 = sha256Hex(readFileSync(result.archivePath));
    expect(result.archiveSha256).toBe(archiveSha256);
    expect(result.files).toBe(9);
    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8")) as ReleaseManifest;
    expect(manifest).toMatchObject({ version: "0.1.0", tag: "v0.1.0", commit: COMMIT, createdAt: "2026-10-04T12:30:15Z", archiveSha256 });
    const dispatch = JSON.parse(readFileSync(result.dispatchPath, "utf8")) as { client_payload: { archiveSha256: string; assetUrl: string } };
    expect(dispatch.client_payload.archiveSha256).toBe(archiveSha256);
    expect(dispatch.client_payload.assetUrl).toBe("https://github.com/technoinspire/untzel/releases/download/v0.1.0/untzel-0.1.0.tar.gz");
  });

  it("lays out app/, docs/ and the notices, and every extracted file matches the manifest", () => {
    const result = packageRelease(request("out"));
    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8")) as ReleaseManifest;
    expect(manifest.files.map((entry) => entry.path)).toEqual([
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
    const extracted = join(repo, "extracted");
    mkdirSync(extracted);
    execFileSync("tar", ["-xzf", result.archivePath, "-C", extracted]);
    for (const entry of manifest.files) {
      const content = readFileSync(join(extracted, entry.path));
      expect({ path: entry.path, sha256: sha256Hex(content), bytes: content.length }).toEqual(entry);
    }
  });

  it("gives the same bytes twice for the same commit", () => {
    const first = packageRelease(request("first"));
    const second = packageRelease(request("second"));
    expect(second.archiveSha256).toBe(first.archiveSha256);
    expect(readFileSync(second.manifestPath, "utf8")).toBe(readFileSync(first.manifestPath, "utf8"));
  });

  it.each([
    ["tag", { tag: "v0.1.0-rc.1" }, /is not a release tag/],
    ["commit", { commit: "0123456" }, /not a full lowercase commit SHA/],
    ["time", { createdAt: "today" }, /is not an ISO 8601 time/],
    ["repository", { repository: "untzel" }, /is not a GitHub repository/],
  ] as const)("writes nothing when the %s is invalid", (_name, overrides, message) => {
    expect(() => packageRelease(request("out", overrides))).toThrow(message);
    expect(existsSync(join(repo, "out"))).toBe(false);
  });

  it.each([
    ["app/changelog.json", "dist/changelog.json"],
    ["docs/pages.json", "dist/docs/pages.json"],
  ])("writes nothing when %s is missing", (required, source) => {
    rmSync(join(repo, source));
    expect(() => packageRelease(request("out"))).toThrow(`${required} is missing`);
    expect(existsSync(join(repo, "out"))).toBe(false);
  });
});
