// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { parseReleaseTag } from "./release-version";

describe("parseReleaseTag", () => {
  it("accepts a stable SemVer tag and drops the v for the version", () => {
    expect(parseReleaseTag("v1.2.3")).toEqual({ tag: "v1.2.3", version: "1.2.3" });
    expect(parseReleaseTag("v0.1.0")).toEqual({ tag: "v0.1.0", version: "0.1.0" });
    expect(parseReleaseTag("v10.0.20")).toEqual({ tag: "v10.0.20", version: "10.0.20" });
  });

  it.each(["1.2.3", "v1.2", "v01.2.3", "v1.02.3", "v1.2.03", "v1.2.3-rc.1", "v1.2.3+b", "V1.2.3", "v1.2.3 ", "", "refs/tags/v1.2.3"])(
    "rejects %j",
    (tag) => {
      expect(() => parseReleaseTag(tag)).toThrow(/is not a release tag/);
    },
  );
});
