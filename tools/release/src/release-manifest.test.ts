// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { buildManifest, manifestFile, normalizeCreatedAt, serializeManifest, sha256Hex } from "./release-manifest";

const COMMIT = "e8e26ef8".padEnd(40, "0");
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function manifest() {
  return buildManifest({
    release: { tag: "v1.2.3", version: "1.2.3" },
    commit: COMMIT,
    createdAt: "2026-10-04T09:30:15-03:00",
    files: [manifestFile("docs/index.html", Buffer.from("abc")), manifestFile("LICENSE", Buffer.alloc(0)), manifestFile("app/index.html", Buffer.from("abc"))],
    archiveSha256: ABC_SHA256,
  });
}

describe("manifestFile", () => {
  it("records the SHA-256 in lowercase hex and the size", () => {
    expect(sha256Hex(Buffer.alloc(0))).toBe(EMPTY_SHA256);
    expect(manifestFile("app/a.js", Buffer.from("abc"))).toEqual({ path: "app/a.js", sha256: ABC_SHA256, bytes: 3 });
  });
});

describe("normalizeCreatedAt", () => {
  it("writes git's %cI time as UTC to the second", () => {
    expect(normalizeCreatedAt("2026-10-04T09:30:15-03:00")).toBe("2026-10-04T12:30:15Z");
    expect(normalizeCreatedAt("2026-10-04T12:30:15.987Z")).toBe("2026-10-04T12:30:15Z");
  });

  it.each(["2026-10-04", "2026-10-04T12:30:15", "yesterday", "2026-13-40T12:30:15Z"])("rejects %j", (value) => {
    expect(() => normalizeCreatedAt(value)).toThrow(/is not an ISO 8601 time/);
  });
});

describe("buildManifest", () => {
  it("sorts the files by path and keeps tag, version, commit and the archive digest", () => {
    const built = manifest();
    expect(built.files.map((file) => file.path)).toEqual(["LICENSE", "app/index.html", "docs/index.html"]);
    expect(built).toMatchObject({ version: "1.2.3", tag: "v1.2.3", commit: COMMIT, createdAt: "2026-10-04T12:30:15Z", archiveSha256: ABC_SHA256 });
  });

  it("rejects a short or uppercase commit and a malformed archive digest", () => {
    const input = { release: { tag: "v1.2.3", version: "1.2.3" }, createdAt: "2026-10-04T12:30:15Z", files: [], archiveSha256: ABC_SHA256 };
    expect(() => buildManifest({ ...input, commit: "e8e26ef8" })).toThrow(/not a full lowercase commit SHA/);
    expect(() => buildManifest({ ...input, commit: COMMIT.toUpperCase() })).toThrow(/not a full lowercase commit SHA/);
    expect(() => buildManifest({ ...input, commit: COMMIT, archiveSha256: ABC_SHA256.toUpperCase() })).toThrow(/not a SHA-256/);
  });
});

describe("serializeManifest", () => {
  it("writes a fixed key order with two spaces and a trailing newline", () => {
    const text = serializeManifest(manifest());
    expect(text.endsWith("}\n")).toBe(true);
    expect(Object.keys(JSON.parse(text) as object)).toEqual(["version", "tag", "commit", "createdAt", "files", "archiveSha256"]);
    expect(text).toContain(`\n  "files": [\n    {\n      "path": "LICENSE",\n      "sha256": "${EMPTY_SHA256}",\n      "bytes": 0\n    },`);
    expect(serializeManifest(JSON.parse(text))).toBe(text);
  });
});
