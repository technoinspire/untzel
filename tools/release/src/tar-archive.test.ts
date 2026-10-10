// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTar, createTarGz, splitTarPath, type ArchiveEntry } from "./tar-archive";

const MTIME = 1_791_100_800;
const longDirectory = `app/${"d".repeat(140)}`;
const longPath = `${longDirectory}/${"f".repeat(90)}.js`;
const entries: readonly ArchiveEntry[] = [
  { path: "docs/index.html", content: Buffer.from("<!doctype html><title>docs</title>\n") },
  { path: "LICENSE", content: Buffer.from("CPAL-1.0\n") },
  { path: "app/empty.txt", content: Buffer.alloc(0) },
  { path: "app/block.bin", content: Buffer.alloc(512, 7) },
  { path: "app/ação.txt", content: Buffer.from("não ASCII\n") },
  { path: longPath, content: Buffer.from("long\n") },
];

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "untzel-tar-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("createTarGz", () => {
  it("gives the same bytes for the same entries, in any input order", () => {
    const first = createTarGz(entries, MTIME);
    const second = createTarGz([...entries].reverse(), MTIME);
    expect(Buffer.compare(first, second)).toBe(0);
  });

  it("fixes the gzip OS byte to 255 (unknown)", () => {
    const archive = createTarGz(entries, MTIME);
    expect([archive[0], archive[1], archive[9]]).toEqual([0x1f, 0x8b, 255]);
    expect(Buffer.compare(gunzipSync(archive), createTar(entries, MTIME))).toBe(0);
  });

  it("is read back by the system tar with the same bytes and the fixed time", () => {
    const archive = join(directory, "release.tar.gz");
    writeFileSync(archive, createTarGz(entries, MTIME));
    const out = join(directory, "out");
    mkdirSync(out);
    execFileSync("tar", ["-xzf", archive, "-C", out]);
    for (const entry of entries) {
      expect(Buffer.compare(readFileSync(join(out, entry.path)), Buffer.from(entry.content))).toBe(0);
    }
    expect(statSync(join(out, "LICENSE")).mtimeMs).toBe(MTIME * 1000);
    // Entry order is code-unit order. The non-ASCII name is checked by extraction above:
    // how `tar -t` prints it depends on the locale.
    const listed = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
    expect(listed).toHaveLength(entries.length);
    expect(listed[1]?.startsWith("app/a")).toBe(true);
    expect(listed.filter((_, index) => index !== 1)).toEqual(["LICENSE", "app/block.bin", longPath, "app/empty.txt", "docs/index.html"]);
  });

  it("writes ustar headers: mode 0644, owner 0, empty owner names, two closing zero blocks", () => {
    const tar = createTar([{ path: "LICENSE", content: Buffer.from("x") }], MTIME);
    expect(tar.length).toBe(512 * 4);
    expect(tar.toString("ascii", 100, 107)).toBe("0000644");
    expect(tar.toString("ascii", 108, 115)).toBe("0000000");
    expect(tar.toString("ascii", 116, 123)).toBe("0000000");
    expect(tar.toString("ascii", 136, 147)).toBe(MTIME.toString(8).padStart(11, "0"));
    expect(tar.toString("ascii", 257, 265)).toBe("ustar\u000000");
    expect(tar.subarray(265, 329).every((byte) => byte === 0)).toBe(true);
    expect(tar.subarray(1024).every((byte) => byte === 0)).toBe(true);
  });

  it("rejects an invalid time", () => {
    expect(() => createTar(entries, -1)).toThrow(/invalid archive time/);
    expect(() => createTar(entries, 1.5)).toThrow(/invalid archive time/);
  });
});

describe("splitTarPath", () => {
  it("keeps a short path in the name field", () => {
    expect(splitTarPath("app/index.html")).toEqual({ name: Buffer.from("app/index.html"), prefix: Buffer.alloc(0) });
  });

  it("splits a long path at a slash into prefix and name", () => {
    const { name, prefix } = splitTarPath(longPath);
    expect(prefix.toString()).toBe(longDirectory);
    expect(name.toString()).toBe(`${"f".repeat(90)}.js`);
  });

  it("rejects a path that cannot fit", () => {
    expect(() => splitTarPath(`app/${"d".repeat(160)}/${"f".repeat(95)}.js`)).toThrow(/does not fit a ustar header/);
    expect(() => splitTarPath(`app/${"f".repeat(101)}`)).toThrow(/does not fit a ustar header/);
  });
});
