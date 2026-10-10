// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { strings } from "../../copy/strings";
import { receivedNoticeModel } from "./received-notice";

describe("receivedNoticeModel", () => {
  it("Remix this says where the music came from", () => {
    expect(receivedNoticeModel({ kind: "remix", from: "link" }, false)).toMatchObject({ isRemixShown: true, remixText: strings.remixFromLink, isFailureShown: false });
    expect(receivedNoticeModel({ kind: "remix", from: "file" }, false).remixText).toBe(strings.remixFromFile);
  });

  it("a failure says why; a load error or unsupported browser hides both", () => {
    const failed = { kind: "failed", message: "This link could not be opened." } as const;
    expect(receivedNoticeModel(failed, false)).toMatchObject({ isRemixShown: false, isFailureShown: true, failureText: failed.message });
    expect(receivedNoticeModel(failed, true)).toMatchObject({ isRemixShown: false, isFailureShown: false });
    expect(receivedNoticeModel(null, false)).toMatchObject({ isRemixShown: false, isFailureShown: false });
  });
});
