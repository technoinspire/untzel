// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { checkRepository, dispatchPayload, serializeDispatchPayload } from "./dispatch-payload";

const SHA = "a".repeat(64);
const release = { tag: "v1.2.3", version: "1.2.3" };

describe("dispatchPayload", () => {
  it("carries the untzel-release event with the tag, version, digest and download URLs", () => {
    expect(dispatchPayload("technoinspire/untzel", release, SHA)).toEqual({
      event_type: "untzel-release",
      client_payload: {
        tag: "v1.2.3",
        version: "1.2.3",
        assetUrl: "https://github.com/technoinspire/untzel/releases/download/v1.2.3/untzel-1.2.3.tar.gz",
        archiveSha256: SHA,
        manifestUrl: "https://github.com/technoinspire/untzel/releases/download/v1.2.3/untzel-1.2.3.manifest.json",
      },
    });
  });

  it("serializes in the order the site reads, two spaces and a trailing newline", () => {
    const text = serializeDispatchPayload(dispatchPayload("technoinspire/untzel", release, SHA));
    expect(text.endsWith("}\n")).toBe(true);
    expect(Object.keys((JSON.parse(text) as { client_payload: object }).client_payload)).toEqual(["tag", "version", "assetUrl", "archiveSha256", "manifestUrl"]);
  });
});

describe("checkRepository", () => {
  it.each(["technoinspire/untzel", "a/b", "Owner-1/repo.name_x"])("accepts %j", (repository) => {
    expect(checkRepository(repository)).toBe(repository);
  });

  it.each(["", "untzel", "owner/", "/repo", "owner/repo/extra", "-owner/repo", "owner/re po", "owner/..", "owner/.", "https://github.com/owner/repo"])(
    "rejects %j",
    (repository) => {
      expect(() => checkRepository(repository)).toThrow(/is not a GitHub repository/);
      expect(() => dispatchPayload(repository, release, SHA)).toThrow(/is not a GitHub repository/);
    },
  );
});
