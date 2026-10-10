// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { REHEARSAL_EVENT, rehearsalPayload, serializeRehearsalPayload, type RehearsalRequest } from "./rehearsal-notice";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const ARCHIVE = "a".repeat(64);

function manifest(overrides: Record<string, unknown> = {}): string {
  return `${JSON.stringify({ version: "0.0.0", tag: "v0.0.0", commit: COMMIT, createdAt: "2026-10-05T12:00:00Z", files: [], archiveSha256: ARCHIVE, ...overrides }, null, 2)}\n`;
}

function request(overrides: Partial<RehearsalRequest> = {}): RehearsalRequest {
  return { manifest: manifest(), runId: "18234567890", ref: "refs/heads/feat/release-rehearsal", repository: "technoinspire/untzel", ...overrides };
}

describe("rehearsalPayload", () => {
  it("names the run and takes commit, tag, version and digest from the manifest", () => {
    expect(rehearsalPayload(request())).toEqual({
      event_type: "untzel-release-rehearsal",
      client_payload: {
        repository: "technoinspire/untzel",
        runId: "18234567890",
        ref: "refs/heads/feat/release-rehearsal",
        commit: COMMIT,
        tag: "v0.0.0",
        version: "0.0.0",
        archiveSha256: ARCHIVE,
      },
    });
    expect(REHEARSAL_EVENT).toBe("untzel-release-rehearsal");
  });

  it("serializes as two-space JSON with a trailing newline", () => {
    const payload = rehearsalPayload(request());
    expect(serializeRehearsalPayload(payload)).toBe(`${JSON.stringify(payload, null, 2)}\n`);
  });

  it.each([["0"], ["01"], ["12a"], ["1".repeat(21)], [""]])("refuses the run id %j", (runId) => {
    expect(() => rehearsalPayload(request({ runId }))).toThrow(/is not a workflow run id/);
  });

  it.each([["refs/tags/v1.0.0"], ["main"], ["refs/heads/"], ["refs/heads/a..b"], ["refs/heads/a b"], ["refs/heads/$(id)"]])("refuses the ref %j", (ref) => {
    expect(() => rehearsalPayload(request({ ref }))).toThrow(/is not a branch ref/);
  });

  it("refuses a repository that is not owner/name", () => {
    expect(() => rehearsalPayload(request({ repository: "untzel" }))).toThrow(/is not a GitHub repository/);
  });

  it.each([
    ["not JSON", "{", /is not JSON/],
    ["an array", "[]", /is not a JSON object/],
    ["a pre-release tag", manifest({ tag: "v0.0.0-rc.1" }), /is not a release tag/],
    ["a version that disagrees with the tag", manifest({ version: "0.0.1" }), /does not match its tag/],
    ["a short commit", manifest({ commit: "0123456" }), /no valid commit/],
    ["an uppercase digest", manifest({ archiveSha256: "A".repeat(64) }), /no valid archiveSha256/],
  ])("refuses a manifest with %s", (_name, text, message) => {
    expect(() => rehearsalPayload(request({ manifest: text }))).toThrow(message);
  });
});
