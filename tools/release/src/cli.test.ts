// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { main } from "./cli";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const GITHUB_OUTPUT_LINE = /^[A-Za-z0-9]+=\S+$/;
let repo: string;
let log: MockInstance<typeof console.log>;
let error: MockInstance<typeof console.error>;

function printed(spy: MockInstance<typeof console.log>): string[] {
  return spy.mock.calls.flatMap((call) => String(call[0]).split("\n"));
}

function packageArgs(overrides: Record<string, string> = {}): string[] {
  const options = { tag: "v0.1.0", commit: COMMIT, "created-at": "2026-10-04T12:30:15Z", repository: "technoinspire/untzel", app: "dist", docs: "dist/docs", out: ".cache/release", ...overrides };
  return ["package", ...Object.entries(options).flatMap(([name, value]) => [`--${name}`, value])];
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "untzel-cli-"));
  for (const path of ["dist/index.html", "dist/changelog.json", "dist/docs/index.html", "dist/docs/pages.json", "LICENSE", "ATTRIBUTION.md", "TRADEMARKS.md"]) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), path);
  }
  log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(repo, { recursive: true, force: true });
});

describe("release version", () => {
  it("prints tag and version as $GITHUB_OUTPUT lines", async () => {
    expect(await main(["version", "--tag", "v1.2.3", "--source", "tag"], { repo })).toBe(0);
    expect(printed(log)).toEqual(["tag=v1.2.3", "version=1.2.3"]);
  });

  it("exits 1 on a tag that is not a stable release", async () => {
    expect(await main(["version", "--tag", "v1.2.3-rc.1", "--source", "tag"], { repo })).toBe(1);
    expect(log).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toMatch(/is not a release tag/);
  });
  it("refuses a pushed v0.0.0 and a rehearsal of any other tag", async () => {
    expect(await main(["version", "--tag", "v0.0.0", "--source", "tag"], { repo })).toBe(1);
    expect(String(error.mock.calls[0]?.[0])).toMatch(/reserved for the rehearsal/);
    expect(await main(["version", "--tag", "v1.2.3", "--source", "rehearsal"], { repo })).toBe(1);
    expect(log).not.toHaveBeenCalled();
  });
  it("prints v0.0.0 for a rehearsal", async () => {
    expect(await main(["version", "--tag", "v0.0.0", "--source", "rehearsal"], { repo })).toBe(0);
    expect(printed(log)).toEqual(["tag=v0.0.0", "version=0.0.0"]);
  });
});

describe("release package", () => {
  it("packages paths relative to the repository and prints $GITHUB_OUTPUT lines", async () => {
    expect(await main(packageArgs(), { repo })).toBe(0);
    const lines = printed(log);
    expect(lines.every((line) => GITHUB_OUTPUT_LINE.test(line))).toBe(true);
    expect(lines).toContain(`archive=${join(repo, ".cache/release/untzel-0.1.0.tar.gz")}`);
    expect(lines).toContain("files=7");
    expect(lines.some((line) => /^archiveSha256=[0-9a-f]{64}$/.test(line))).toBe(true);
  });

  it("exits 1 on invalid input", async () => {
    expect(await main(packageArgs({ commit: "abc" }), { repo })).toBe(1);
    expect(await main(packageArgs({ app: "missing" }), { repo })).toBe(1);
  });

  it("exits 1 when the docs index is missing", async () => {
    rmSync(join(repo, "dist/docs/pages.json"));
    expect(await main(packageArgs(), { repo })).toBe(1);
    expect(String(error.mock.calls[0]?.[0])).toMatch(/docs\/pages\.json is missing/);
  });
});

function rehearsalArgs(overrides: Record<string, string> = {}): string[] {
  const options = {
    manifest: ".cache/release/untzel-0.0.0.manifest.json",
    "run-id": "18234567890",
    ref: "refs/heads/feat/release-rehearsal",
    repository: "technoinspire/untzel",
    out: ".cache/release/untzel-0.0.0.rehearsal.json",
    ...overrides,
  };
  return ["rehearsal-notice", ...Object.entries(options).flatMap(([name, value]) => [`--${name}`, value])];
}

describe("release rehearsal-notice", () => {
  beforeEach(async () => {
    expect(await main(packageArgs({ tag: "v0.0.0" }), { repo })).toBe(0);
    log.mockClear();
  });

  it("writes the rehearsal dispatch body from the manifest and prints its path", async () => {
    expect(await main(rehearsalArgs(), { repo })).toBe(0);
    const out = join(repo, ".cache/release/untzel-0.0.0.rehearsal.json");
    expect(printed(log)).toEqual([`rehearsal=${out}`]);
    const manifest = JSON.parse(readFileSync(join(repo, ".cache/release/untzel-0.0.0.manifest.json"), "utf8")) as { archiveSha256: string };
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual({
      event_type: "untzel-release-rehearsal",
      client_payload: {
        repository: "technoinspire/untzel",
        runId: "18234567890",
        ref: "refs/heads/feat/release-rehearsal",
        commit: COMMIT,
        tag: "v0.0.0",
        version: "0.0.0",
        archiveSha256: manifest.archiveSha256,
      },
    });
  });

  it.each([[{ "run-id": "0" }], [{ ref: "refs/tags/v1.0.0" }], [{ repository: "untzel" }], [{ manifest: "missing.json" }]])("exits 1 on %j", async (overrides) => {
    expect(await main(rehearsalArgs(overrides), { repo })).toBe(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("exits 2 without --out", async () => {
    expect(await main(rehearsalArgs().slice(0, -2), { repo })).toBe(2);
    expect(String(error.mock.calls[0]?.[0])).toMatch(/usage:/);
  });
});

describe("usage", () => {
  it.each([
    [[]],
    [["publish"]],
    [["version"]],
    [["version", "--tag"]],
    [["version", "--tag", "v1.2.3", "--tag", "v1.2.4"]],
    [["version", "--tag", "v1.2.3", "--force", "yes"]],
    [["version", "--tag", "v1.2.3"]],
    [["version", "--tag", "v1.2.3", "--source", "branch"]],
    [packageArgs().filter((arg) => arg !== "--out" && arg !== ".cache/release")],
  ])("exits 2 for %j", async (args) => {
    expect(await main(args, { repo })).toBe(2);
    expect(String(error.mock.calls[0]?.[0])).toMatch(/usage:/);
  });
});
